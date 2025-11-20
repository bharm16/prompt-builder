import { IAIClient, AIResponse, AIClientError } from '../interfaces/IAIClient.js';

/**
 * OpenAI API Client Implementation
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on OpenAI API communication
 * - LSP: Implements IAIClient contract without modifications
 * - DIP: Depends on logger, metrics, circuit breaker abstractions
 * - ISP: Clean interface for AI completion only
 */
export class OpenAIAPIClient extends IAIClient {
  constructor({
    apiKey,
    config = {},
    circuitBreaker = null,
    concurrencyLimiter = null,
    logger = null,
    metricsCollector = null,
  }) {
    super();
    
    this.apiKey = apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';
    this.defaultTimeout = config.timeout || 60000;
    
    // Injected dependencies (DIP compliance)
    this.circuitBreaker = circuitBreaker;
    this.concurrencyLimiter = concurrencyLimiter;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Complete a prompt with OpenAI
   * Implements IAIClient.complete()
   */
  async complete(systemPrompt, options = {}) {
    const startTime = Date.now();
    
    try {
      // Use concurrency limiter and circuit breaker if available
      const executeRequest = async () => {
        if (this.circuitBreaker) {
          return await this.circuitBreaker.execute(() => this._makeRequest(systemPrompt, options));
        }
        return await this._makeRequest(systemPrompt, options);
      };
      
      const result = this.concurrencyLimiter
        ? await this.concurrencyLimiter.execute(executeRequest, options)
        : await executeRequest();
      
      const duration = Date.now() - startTime;
      
      this.logger?.debug('OpenAI API call succeeded', {
        duration,
        model: this.model,
      });
      
      this.metricsCollector?.recordSuccess('openai-api', duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger?.error('OpenAI API call failed', error, { duration });
      this.metricsCollector?.recordFailure('openai-api', duration);
      
      throw new AIClientError(
        `OpenAI API error: ${error.message}`,
        error.statusCode || 500,
        error
      );
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
          response_format: { type: 'json_object' },
        }),
        signal: options.signal || controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new AIClientError(
          `OpenAI API error: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      const data = await response.json();
      
      // Return standardized AIResponse (LSP compliance)
      return new AIResponse(
        data.choices[0]?.message?.content || '',
        {
          model: data.model,
          usage: data.usage,
          finishReason: data.choices[0]?.finish_reason,
        }
      );
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AIClientError(`Request timeout after ${timeout}ms`, 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check for OpenAI API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.complete('Respond with "healthy"', {
        maxTokens: 10,
        timeout: 5000,
      });
      const duration = Date.now() - startTime;

      return {
        healthy: true,
        responseTime: duration,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}
