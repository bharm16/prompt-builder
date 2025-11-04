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
 * Groq API Client with circuit breaker pattern
 * Provides ultra-fast draft generation using Llama 3.1 8B Instant
 *
 * Designed for two-stage optimization:
 * - Stage 1: Fast draft generation (200-500ms)
 * - Stage 2: Quality refinement with slower models
 */
export class GroqAPIClient {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.model = config.model || 'llama-3.1-8b-instant';
    this.defaultTimeout = config.timeout || 5000; // 5s for fast drafts

    // Circuit breaker configuration - more lenient than OpenAI
    const breakerOptions = {
      timeout: config.timeout || 5000, // Fast timeout for draft generation
      errorThresholdPercentage: 60, // Groq is fast, tolerate more errors
      resetTimeout: 15000, // Quick recovery
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'groq-api',
    };

    this.breaker = new CircuitBreaker(
      this._makeRequest.bind(this),
      breakerOptions
    );

    // Circuit breaker event handlers
    this.breaker.on('open', () => {
      logger.error('Circuit breaker OPEN - Groq API failing');
      metricsService.updateCircuitBreakerState('groq-api', 'open');
    });

    this.breaker.on('halfOpen', () => {
      logger.warn('Circuit breaker HALF-OPEN - Testing Groq API');
      metricsService.updateCircuitBreakerState('groq-api', 'half-open');
    });

    this.breaker.on('close', () => {
      logger.info('Circuit breaker CLOSED - Groq API healthy');
      metricsService.updateCircuitBreakerState('groq-api', 'closed');
    });

    // Initially set circuit breaker state to closed
    metricsService.updateCircuitBreakerState('groq-api', 'closed');
  }

  /**
   * Generate a draft prompt with Groq (non-streaming)
   * @param {string} systemPrompt - System prompt
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Groq API response (Claude-compatible format)
   */
  async complete(systemPrompt, options = {}) {
    const startTime = Date.now();
    const endpoint = 'chat/completions';

    try {
      const result = await this.breaker.fire(systemPrompt, options);
      const duration = Date.now() - startTime;

      // Record successful API call
      metricsService.recordClaudeAPICall('groq-' + endpoint, duration, true);
      logger.debug('Groq API call succeeded', {
        endpoint,
        duration,
        model: this.model,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed API call
      metricsService.recordClaudeAPICall('groq-' + endpoint, duration, false);

      if (this.breaker.opened) {
        logger.error('Groq API circuit breaker is open', error);
        throw new ServiceUnavailableError('Groq API is currently unavailable');
      }

      logger.error('Groq API call failed', error, { endpoint, duration });
      throw error;
    }
  }

  /**
   * Generate a draft prompt with streaming (for real-time UI updates)
   * @param {string} systemPrompt - System prompt
   * @param {Object} options - Additional options
   * @param {Function} options.onChunk - Callback for each streamed chunk
   * @param {string} options.userMessage - User message
   * @param {number} options.maxTokens - Max tokens to generate
   * @param {number} options.temperature - Temperature (0-2)
   * @returns {Promise<string>} Complete generated text
   */
  async streamComplete(systemPrompt, options = {}) {
    const startTime = Date.now();
    const { onChunk, userMessage, maxTokens, temperature } = options;

    if (!onChunk || typeof onChunk !== 'function') {
      throw new Error('onChunk callback is required for streaming');
    }

    const controller = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let fullText = '';

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage || 'Please proceed.' }
      ];

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: maxTokens || 500, // Keep drafts concise
          temperature: temperature !== undefined ? temperature : 0.7,
          stream: true, // Enable streaming
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();

        // Parse error for better messaging
        let errorMessage = `Groq API error: ${response.status} - ${errorBody}`;
        let parsedError;
        try {
          parsedError = JSON.parse(errorBody);
        } catch {
          // Keep original error if not JSON
        }

        // Provide clear error messages for common issues
        if (response.status === 401) {
          if (parsedError?.error?.code === 'invalid_api_key') {
            errorMessage = `Invalid Groq API key. Please check your GROQ_API_KEY in the .env file and regenerate at https://console.groq.com`;
          } else {
            errorMessage = `Groq API authentication failed. Please verify your API key at https://console.groq.com`;
          }
        } else if (response.status === 429) {
          errorMessage = `Groq API rate limit exceeded. Please wait before retrying or upgrade your plan.`;
        } else if (response.status === 500) {
          errorMessage = `Groq API server error. The service may be temporarily unavailable.`;
        }

        throw new APIError(errorMessage, response.status);
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                fullText += content;
                onChunk(content); // Stream to UI
              }
            } catch (e) {
              // Skip malformed JSON chunks
              logger.debug('Skipping malformed SSE chunk', { chunk: data });
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      metricsService.recordClaudeAPICall('groq-stream', duration, true);

      logger.debug('Groq streaming completed', {
        duration,
        textLength: fullText.length,
      });

      return fullText;
    } catch (error) {
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      metricsService.recordClaudeAPICall('groq-stream', duration, false);

      if (error.name === 'AbortError') {
        throw new TimeoutError(`Groq API request timeout after ${timeout}ms`);
      }

      logger.error('Groq streaming failed', error);
      throw error;
    }
  }

  /**
   * Internal method to make the actual API request (non-streaming)
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
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();

        // Parse error for better messaging
        let errorMessage = `Groq API error: ${response.status} - ${errorBody}`;
        let parsedError;
        try {
          parsedError = JSON.parse(errorBody);
        } catch {
          // Keep original error if not JSON
        }

        // Provide clear error messages for common issues
        if (response.status === 401) {
          if (parsedError?.error?.code === 'invalid_api_key') {
            errorMessage = `Invalid Groq API key. Please check your GROQ_API_KEY in the .env file and regenerate at https://console.groq.com`;
          } else {
            errorMessage = `Groq API authentication failed. Please verify your API key at https://console.groq.com`;
          }
        } else if (response.status === 429) {
          errorMessage = `Groq API rate limit exceeded. Please wait before retrying or upgrade your plan.`;
        } else if (response.status === 500) {
          errorMessage = `Groq API server error. The service may be temporarily unavailable.`;
        }

        throw new APIError(errorMessage, response.status);
      }

      const data = await response.json();

      // Transform to Claude-compatible format
      return {
        content: [
          {
            text: data.choices[0]?.message?.content || ''
          }
        ],
        _original: data
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new TimeoutError(`Groq API request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Health check for Groq API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.complete('Respond with "healthy"', {
        maxTokens: 10,
        timeout: 3000,
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
