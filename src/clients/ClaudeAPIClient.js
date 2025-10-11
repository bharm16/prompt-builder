import CircuitBreaker from 'opossum';
import { logger } from '../infrastructure/Logger.js';
import { metricsService } from '../infrastructure/MetricsService.js';

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
 * Claude API Client with circuit breaker pattern
 * Provides resilient communication with Anthropic's Claude API
 */
export class ClaudeAPIClient {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.defaultTimeout = config.timeout || 60000; // Increased to 60s for video mode prompts

    // Circuit breaker configuration
    // Timeout needs to accommodate video mode prompts which can take 60+ seconds
    const breakerOptions = {
      timeout: config.timeout || 60000, // 60 seconds to handle large video prompts
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 30000, // Try again after 30 seconds
      rollingCountTimeout: 10000, // 10 second window for error calculation
      rollingCountBuckets: 10,
      name: 'claude-api',
    };

    this.breaker = new CircuitBreaker(
      this._makeRequest.bind(this),
      breakerOptions
    );

    // Circuit breaker event handlers
    this.breaker.on('open', () => {
      logger.error('Circuit breaker OPEN - Claude API failing');
      metricsService.updateCircuitBreakerState('claude-api', 'open');
    });

    this.breaker.on('halfOpen', () => {
      logger.warn('Circuit breaker HALF-OPEN - Testing Claude API');
      metricsService.updateCircuitBreakerState('claude-api', 'half-open');
    });

    this.breaker.on('close', () => {
      logger.info('Circuit breaker CLOSED - Claude API healthy');
      metricsService.updateCircuitBreakerState('claude-api', 'closed');
    });

    // Initially set circuit breaker state to closed
    metricsService.updateCircuitBreakerState('claude-api', 'closed');
  }

  /**
   * Complete a prompt with Claude
   * @param {string} systemPrompt - System prompt for Claude
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Claude API response
   */
  async complete(systemPrompt, options = {}) {
    const startTime = Date.now();
    const endpoint = 'messages';

    try {
      const result = await this.breaker.fire(systemPrompt, options);
      const duration = Date.now() - startTime;

      // Record successful API call
      metricsService.recordClaudeAPICall(endpoint, duration, true);
      logger.debug('Claude API call succeeded', {
        endpoint,
        duration,
        model: this.model,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed API call
      metricsService.recordClaudeAPICall(endpoint, duration, false);

      if (this.breaker.opened) {
        logger.error('Claude API circuit breaker is open', error);
        throw new ServiceUnavailableError('Claude API is currently unavailable');
      }

      logger.error('Claude API call failed', error, { endpoint, duration });
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
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || this.model,
          max_tokens: options.maxTokens || 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: options.userMessage || 'Please proceed.' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new APIError(
          `Claude API error: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new TimeoutError(`Claude API request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Health check for Claude API
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
}
