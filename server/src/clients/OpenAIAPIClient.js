import CircuitBreaker from 'opossum';
import { logger } from '../infrastructure/Logger.js';
import { metricsService } from '../infrastructure/MetricsService.js';
import { openAILimiter } from '../utils/ConcurrencyLimiter.js';

/**
 * Custom error classes for better error handling
 */
export class APIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * OpenAI API Client with circuit breaker pattern
 * Provides resilient communication with OpenAI's API
 */
export class OpenAIAPIClient {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini'; // Default to gpt-4o-mini (fast & cost-effective)
    this.defaultTimeout = config.timeout || 60000; // 60 seconds

    // Circuit breaker configuration
    const breakerOptions = {
      timeout: config.timeout || 60000, // 60 seconds to handle large prompts
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 30000, // Try again after 30 seconds
      rollingCountTimeout: 10000, // 10 second window for error calculation
      rollingCountBuckets: 10,
      name: 'openai-api',
    };

    this.breaker = new CircuitBreaker(
      this._makeRequest.bind(this),
      breakerOptions
    );

    // Circuit breaker event handlers
    this.breaker.on('open', () => {
      logger.error('Circuit breaker OPEN - OpenAI API failing');
      metricsService.updateCircuitBreakerState('openai-api', 'open');
    });

    this.breaker.on('halfOpen', () => {
      logger.warn('Circuit breaker HALF-OPEN - Testing OpenAI API');
      metricsService.updateCircuitBreakerState('openai-api', 'half-open');
    });

    this.breaker.on('close', () => {
      logger.info('Circuit breaker CLOSED - OpenAI API healthy');
      metricsService.updateCircuitBreakerState('openai-api', 'closed');
    });

    // Initially set circuit breaker state to closed
    metricsService.updateCircuitBreakerState('openai-api', 'closed');
  }

  /**
   * Complete a prompt with OpenAI
   *
   * This method enforces a maximum of 5 concurrent requests to prevent hitting
   * OpenAI's rate limits. Additional requests are queued and processed when
   * slots become available.
   *
   * @param {string} systemPrompt - System prompt for OpenAI
   * @param {Object} options - Additional options
   * @param {AbortSignal} options.signal - Optional abort signal for cancellation
   * @param {boolean} options.priority - If true, cancels oldest queued request
   * @returns {Promise<Object>} OpenAI API response (formatted like Claude for compatibility)
   */
  async complete(systemPrompt, options = {}) {
    const startTime = Date.now();
    const endpoint = 'chat/completions';

    try {
      // Wrap the circuit breaker call with concurrency limiting
      // This ensures we never exceed 5 concurrent OpenAI API requests
      const result = await openAILimiter.execute(
        async () => {
          return await this.breaker.fire(systemPrompt, options);
        },
        {
          signal: options.signal,
          priority: options.priority,
        }
      );

      const duration = Date.now() - startTime;

      // Record successful API call
      metricsService.recordClaudeAPICall(endpoint, duration, true);
      logger.debug('OpenAI API call succeeded', {
        endpoint,
        duration,
        model: this.model,
        limiterStats: openAILimiter.getQueueStatus(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed API call
      metricsService.recordClaudeAPICall(endpoint, duration, false);

      // Handle queue-specific errors
      if (error.code === 'QUEUE_TIMEOUT') {
        logger.error('OpenAI API request timed out in queue', {
          endpoint,
          duration,
          limiterStats: openAILimiter.getStats(),
        });
        throw new TimeoutError('AI API request timed out in queue - system overloaded');
      }

      if (error.code === 'CANCELLED') {
        logger.debug('OpenAI API request cancelled', { endpoint, duration });
        throw error;
      }

      if (this.breaker.opened) {
        logger.error('OpenAI API circuit breaker is open', error);
        throw new ServiceUnavailableError('AI API is currently unavailable');
      }

      logger.error('OpenAI API call failed', error, { endpoint, duration });
      throw error;
    }
  }

  /**
   * Internal method to make the actual API request
   * @private
   */
  async _makeRequest(systemPrompt, options = {}) {
    const controller = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userMessage || 'Please proceed.' }
      ];

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature !== undefined ? options.temperature : 1.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new APIError(
          `AI API error: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      const data = await response.json();

      // Transform OpenAI response to match Claude's format for compatibility
      // Claude format: { content: [{ text: "..." }] }
      // OpenAI format: { choices: [{ message: { content: "..." } }] }
      return {
        content: [
          {
            text: data.choices[0]?.message?.content || ''
          }
        ],
        // Include original response for debugging
        _original: data
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new TimeoutError(`AI API request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Health check for OpenAI API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      // Simple test request with minimal tokens
      await this.complete('Respond with "healthy"', {
        maxTokens: 10,
        timeout: 5000,
      });
      const duration = Date.now() - startTime;

      return {
        healthy: true,
        responseTime: duration,
        circuitBreakerState: this.getCircuitBreakerState(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        circuitBreakerState: this.getCircuitBreakerState(),
      };
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      state: this.getCircuitBreakerState(),
      stats: this.breaker.stats,
    };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    if (this.breaker.opened) return 'OPEN';
    if (this.breaker.halfOpen) return 'HALF-OPEN';
    return 'CLOSED';
  }

  /**
   * Get concurrency limiter statistics
   * Useful for monitoring queue depth and performance
   */
  getConcurrencyStats() {
    return openAILimiter.getStats();
  }

  /**
   * Get current queue status
   * Useful for real-time monitoring
   */
  getQueueStatus() {
    return openAILimiter.getQueueStatus();
  }
}
