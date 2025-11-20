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
 * Generic LLM Client for OpenAI-compatible APIs
 * 
 * Works with any provider that follows the OpenAI chat completions API format:
 * - OpenAI (api.openai.com)
 * - Groq (api.groq.com/openai/v1)
 * - Together AI (api.together.xyz/v1)
 * - Any other OpenAI-compatible endpoint
 * 
 * Features:
 * - Circuit breaker pattern for resilience
 * - Optional concurrency limiting
 * - Automatic response normalization
 * - JSON mode support
 * - Streaming support
 * - Health checks
 */
export class LLMClient {
  constructor({ 
    apiKey, 
    baseURL,
    providerName,
    defaultModel,
    defaultTimeout = 60000,
    circuitBreakerConfig = {},
    concurrencyLimiter = null,
  }) {
    if (!apiKey) {
      throw new Error(`API key required for ${providerName || 'LLM client'}`);
    }
    if (!baseURL) {
      throw new Error(`Base URL required for ${providerName || 'LLM client'}`);
    }
    if (!defaultModel) {
      throw new Error(`Default model required for ${providerName || 'LLM client'}`);
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.providerName = providerName || 'llm';
    this.model = defaultModel;
    this.defaultTimeout = defaultTimeout;
    this.concurrencyLimiter = concurrencyLimiter;

    // Merge default circuit breaker options with provider-specific config
    const breakerOptions = {
      timeout: defaultTimeout,
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

    try {
      // Execute with optional concurrency limiting
      const executeRequest = async () => {
        return await this.breaker.fire(systemPrompt, options);
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
        model: options.model || this.model,
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
    const controller = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let fullText = '';

    try {
      // Support full messages array or system + user pattern
      const messages = options.messages || [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userMessage || 'Please proceed.' }
      ];

      // Build request payload
      const payload = {
        model: options.model || this.model,
        messages: messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        stream: true,
      };

      // Conditionally add JSON mode
      if (options.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        // Determine if error is retryable
        const isRetryable = response.status >= 500 || response.status === 429;
        throw new APIError(
          `${this.providerName} API error: ${response.status} - ${errorBody}`,
          response.status,
          isRetryable
        );
      }

      // Robust SSE parsing with buffer handling
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append to buffer (handles partial chunks)
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep last line in buffer if incomplete (no trailing newline)
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          // Skip empty lines and comments (keep-alive)
          if (!trimmed || trimmed.startsWith(':')) continue;
          
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);

            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                fullText += content;
                options.onChunk(content);
              }
            } catch (e) {
              // Ignore malformed chunks - don't break the stream
              logger.debug('Skipping malformed SSE chunk', { chunk: data.substring(0, 100) });
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      metricsService.recordClaudeAPICall(`${this.providerName}-stream`, duration, true);

      logger.debug(`${this.providerName} streaming completed`, {
        duration,
        textLength: fullText.length,
      });

      return fullText;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
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
    const controller = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Support full messages array or system + user pattern
      const messages = options.messages || [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userMessage || 'Please proceed.' }
      ];

      // Build request payload
      const payload = {
        model: options.model || this.model,
        messages: messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
      };

      // Conditionally add JSON mode only when requested
      if (options.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        // Determine if error is retryable
        // 400/401/403 are NOT retryable, 429/5xx ARE retryable
        const isRetryable = response.status >= 500 || response.status === 429;
        throw new APIError(
          `${this.providerName} API error: ${response.status} - ${errorBody}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json();

      // Normalize to Claude-compatible format
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
        throw new TimeoutError(`${this.providerName} API request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Health check for the API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.complete('Respond with valid JSON containing: {"status": "healthy"}', {
        maxTokens: 50,
        timeout: 5000,
        jsonMode: true, // Enable JSON mode for health check
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
}

