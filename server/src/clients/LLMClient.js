import CircuitBreaker from 'opossum';
import { logger } from '../infrastructure/Logger.js';
import { metricsService } from '../infrastructure/MetricsService.js';

/**
 * Custom error classes for better error handling
 */
export class APIError extends Error {
  constructor(message, statusCode, isRetryable = true) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    // 400/401/403 are NOT retryable (bad request, auth errors)
    // 429/5xx ARE retryable (rate limits, server errors)
    this.isRetryable = isRetryable;
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
 * Generic LLM Client powered by provider adapters
 *
 * The client owns cross-cutting concerns (circuit breaker, concurrency limiting,
 * metrics) and delegates protocol-specific work to an adapter.
 */
export class LLMClient {
  constructor({
    adapter,
    providerName,
    defaultTimeout = 60000,
    circuitBreakerConfig = {},
    concurrencyLimiter = null,
  }) {
    if (!adapter || typeof adapter.complete !== 'function') {
      throw new Error('LLMClient requires an adapter with a complete() method');
    }

    this.adapter = adapter;
    this.providerName = providerName || adapter.providerName || 'llm';
    this.defaultModel = adapter.defaultModel;
    this.defaultTimeout = defaultTimeout || adapter.defaultTimeout || 60000;
    this.concurrencyLimiter = concurrencyLimiter;
    this.capabilities = adapter.capabilities || {
      streaming: typeof adapter.streamComplete === 'function',
    };

    if (!this.defaultModel) {
      throw new Error(`Default model required for ${this.providerName} adapter`);
    }

    // Merge default circuit breaker options with provider-specific config
    const breakerOptions = {
      timeout: this.defaultTimeout,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: `${this.providerName}-api`,
      ...circuitBreakerConfig,
    };

    this.breaker = new CircuitBreaker(
      this._makeRequest.bind(this),
      breakerOptions
    );

    // Circuit breaker event handlers
    this.breaker.on('open', () => {
      logger.error(`Circuit breaker OPEN - ${this.providerName} API failing`);
      metricsService.updateCircuitBreakerState(`${this.providerName}-api`, 'open');
    });

    this.breaker.on('halfOpen', () => {
      logger.warn(`Circuit breaker HALF-OPEN - Testing ${this.providerName} API`);
      metricsService.updateCircuitBreakerState(`${this.providerName}-api`, 'half-open');
    });

    this.breaker.on('close', () => {
      logger.info(`Circuit breaker CLOSED - ${this.providerName} API healthy`);
      metricsService.updateCircuitBreakerState(`${this.providerName}-api`, 'closed');
    });

    // Initially set circuit breaker state to closed
    metricsService.updateCircuitBreakerState(`${this.providerName}-api`, 'closed');
  }

  /**
   * Complete a prompt with the LLM (non-streaming)
   * @param {string} systemPrompt - System prompt
   * @param {Object} options - Additional options
   * @param {string} options.userMessage - User message
   * @param {string} options.model - Override default model
   * @param {number} options.maxTokens - Max tokens to generate
   * @param {number} options.temperature - Temperature (0-2)
   * @param {number} options.timeout - Request timeout in ms
   * @param {AbortSignal} options.signal - Abort signal for cancellation
   * @param {boolean} options.priority - Priority flag for queue management
   * @returns {Promise<Object>} API response in normalized format
   */
  async complete(systemPrompt, options = {}) {
    const startTime = Date.now();
    const endpoint = 'chat/completions';
    const requestOptions = this._applyDefaults(options);

    try {
      // Execute with optional concurrency limiting
      const executeRequest = async () => {
        return await this.breaker.fire(systemPrompt, requestOptions);
      };

      const result = this.concurrencyLimiter
        ? await this.concurrencyLimiter.execute(executeRequest, {
            signal: options.signal,
            priority: options.priority,
          })
        : await executeRequest();

      const duration = Date.now() - startTime;

      // Record successful API call
      metricsService.recordClaudeAPICall(`${this.providerName}-${endpoint}`, duration, true);
      logger.debug(`${this.providerName} API call succeeded`, {
        endpoint,
        duration,
        model: requestOptions.model,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed API call
      metricsService.recordClaudeAPICall(`${this.providerName}-${endpoint}`, duration, false);

      // Handle concurrency limiter errors
      if (error.code === 'QUEUE_TIMEOUT') {
        logger.error(`${this.providerName} API request timed out in queue`, {
          endpoint,
          duration,
        });
        throw new TimeoutError(`${this.providerName} API request timed out in queue - system overloaded`);
      }

      if (error.code === 'CANCELLED') {
        logger.debug(`${this.providerName} API request cancelled`, { endpoint, duration });
        throw error;
      }

      if (this.breaker.opened) {
        logger.error(`${this.providerName} API circuit breaker is open`, error);
        throw new ServiceUnavailableError(`${this.providerName} API is currently unavailable`);
      }

      logger.error(`${this.providerName} API call failed`, {
        endpoint,
        duration,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Stream completion with real-time chunks
   * @param {string} systemPrompt - System prompt
   * @param {Object} options - Additional options
   * @param {Function} options.onChunk - Callback for each streamed chunk
   * @param {string} options.userMessage - User message
   * @param {Array} options.messages - Full messages array (alternative to systemPrompt)
   * @param {number} options.maxTokens - Max tokens to generate
   * @param {number} options.temperature - Temperature (0-2)
   * @param {boolean} options.jsonMode - Enable JSON mode
   * @param {boolean} options.priority - Priority flag for queue management
   * @param {AbortSignal} options.signal - Abort signal for cancellation
   * @returns {Promise<string>} Complete generated text
   */
  async streamComplete(systemPrompt, options = {}) {
    const startTime = Date.now();

    if (!options.onChunk || typeof options.onChunk !== 'function') {
      throw new Error('onChunk callback is required for streaming');
    }

    // Execute with optional concurrency limiting (critical fix!)
    const executeStream = async () => {
      return await this._executeStream(systemPrompt, options, startTime);
    };

    try {
      return this.concurrencyLimiter
        ? await this.concurrencyLimiter.execute(executeStream, {
            signal: options.signal,
            priority: options.priority,
          })
        : await executeStream();
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordClaudeAPICall(`${this.providerName}-stream`, duration, false);

      // Handle concurrency limiter errors
      if (error.code === 'QUEUE_TIMEOUT') {
        throw new TimeoutError(`${this.providerName} streaming request timed out in queue - system overloaded`);
      }

      if (error.code === 'CANCELLED') {
        logger.debug(`${this.providerName} streaming request cancelled`);
        throw error;
      }

      throw error;
    }
  }

  /**
   * Internal streaming execution with robust SSE parsing
   * @private
   */
  async _executeStream(systemPrompt, options, startTime) {
    if (!this.capabilities.streaming || typeof this.adapter.streamComplete !== 'function') {
      throw new Error(`${this.providerName} adapter does not support streaming`);
    }

    let fullText = '';

    try {
      const requestOptions = this._applyDefaults(options);
      fullText = await this.adapter.streamComplete(systemPrompt, requestOptions);

      const duration = Date.now() - startTime;
      metricsService.recordClaudeAPICall(`${this.providerName}-stream`, duration, true);

      logger.debug(`${this.providerName} streaming completed`, {
        duration,
        textLength: fullText.length,
      });

      return fullText;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeout = options.timeout || this.defaultTimeout;
        throw new TimeoutError(`${this.providerName} streaming request timeout after ${timeout}ms`);
      }

      logger.error(`${this.providerName} streaming failed`, { error: error.message });
      throw error;
    }
  }

  /**
   * Internal method to make the actual API request (non-streaming)
   * @private
   */
  async _makeRequest(systemPrompt, options = {}) {
    const requestOptions = this._applyDefaults(options);
    return await this.adapter.complete(systemPrompt, requestOptions);
  }

  /**
   * Health check for the API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const startTime = Date.now();

    try {
      let result;

      if (typeof this.adapter.healthCheck === 'function') {
        result = await this.adapter.healthCheck();
      } else {
        await this.complete('Respond with valid JSON containing: {"status": "healthy"}', {
          maxTokens: 50,
          timeout: 30000,
          jsonMode: true,
        });
        result = { healthy: true };
      }

      const duration = Date.now() - startTime;

      return {
        ...result,
        healthy: result.healthy !== false,
        responseTime: result.responseTime || duration,
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
   * Get concurrency limiter statistics (if available)
   */
  getConcurrencyStats() {
    return this.concurrencyLimiter ? this.concurrencyLimiter.getStats() : null;
  }

  /**
   * Get current queue status (if concurrency limiter available)
   */
  getQueueStatus() {
    return this.concurrencyLimiter ? this.concurrencyLimiter.getQueueStatus() : null;
  }

  /**
   * Apply defaults to request options without mutating the original
   * @private
   */
  _applyDefaults(options = {}) {
    return {
      ...options,
      model: options.model || this.defaultModel,
      timeout: options.timeout || this.defaultTimeout,
    };
  }
}
