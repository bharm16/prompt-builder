import CircuitBreaker from 'opossum';
import { logger } from '../infrastructure/Logger.ts';
import { metricsService } from '../infrastructure/MetricsService.js';
import type { IAIClient, AIResponse } from '../interfaces/IAIClient.js';

/**
 * Custom error classes for better error handling
 */
export class APIError extends Error {
  statusCode: number;
  isRetryable: boolean;

  constructor(message: string, statusCode: number, isRetryable: boolean = true) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    // 400/401/403 are NOT retryable (bad request, auth errors)
    // 429/5xx ARE retryable (rate limits, server errors)
    this.isRetryable = isRetryable;
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

interface Adapter {
  complete(systemPrompt: string, options?: CompletionOptions): Promise<AIResponse>;
  streamComplete?(systemPrompt: string, options?: StreamCompletionOptions): Promise<string>;
  healthCheck?(): Promise<{ healthy: boolean; [key: string]: unknown }>;
  providerName?: string;
  defaultModel?: string;
  defaultTimeout?: number;
  capabilities?: {
    streaming?: boolean;
  };
}

interface CompletionOptions {
  userMessage?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  signal?: AbortSignal;
  priority?: boolean;
  jsonMode?: boolean;
  isArray?: boolean;
  responseFormat?: { type: string; [key: string]: unknown };
  messages?: Array<{ role: string; content: string }>;
}

interface StreamCompletionOptions extends CompletionOptions {
  onChunk: (chunk: string) => void;
}

interface CircuitBreakerConfig {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  name?: string;
}

interface ConcurrencyLimiter {
  execute<T>(fn: () => Promise<T>, options?: { signal?: AbortSignal; priority?: boolean }): Promise<T>;
  getStats?(): unknown;
  getQueueStatus?(): unknown;
}

interface LLMClientConfig {
  adapter: Adapter;
  providerName?: string;
  defaultTimeout?: number;
  circuitBreakerConfig?: CircuitBreakerConfig;
  concurrencyLimiter?: ConcurrencyLimiter | null;
}

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  responseTime?: number;
  circuitBreakerState?: string;
}

/**
 * Generic LLM Client powered by provider adapters
 *
 * The client owns cross-cutting concerns (circuit breaker, concurrency limiting,
 * metrics) and delegates protocol-specific work to an adapter.
 */
export class LLMClient implements IAIClient {
  private adapter: Adapter;
  private providerName: string;
  private defaultModel: string;
  private defaultTimeout: number;
  private concurrencyLimiter: ConcurrencyLimiter | null;
  private capabilities: { streaming: boolean };
  private breaker: CircuitBreaker<[string, CompletionOptions], AIResponse>;

  constructor({
    adapter,
    providerName,
    defaultTimeout = 60000,
    circuitBreakerConfig = {},
    concurrencyLimiter = null,
  }: LLMClientConfig) {
    if (!adapter || typeof adapter.complete !== 'function') {
      throw new Error('LLMClient requires an adapter with a complete() method');
    }

    this.adapter = adapter;
    this.providerName = providerName || adapter.providerName || 'llm';
    this.defaultModel = adapter.defaultModel || '';
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
   */
  async complete(systemPrompt: string, options: CompletionOptions = {}): Promise<AIResponse> {
    const startTime = Date.now();
    const endpoint = 'chat/completions';
    const requestOptions = this._applyDefaults(options);

    try {
      // Execute with optional concurrency limiting
      const executeRequest = async (): Promise<AIResponse> => {
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

      const errorObj = error as Error & { code?: string };

      // Handle concurrency limiter errors
      if (errorObj.code === 'QUEUE_TIMEOUT') {
        logger.error(`${this.providerName} API request timed out in queue`, {
          endpoint,
          duration,
        });
        throw new TimeoutError(`${this.providerName} API request timed out in queue - system overloaded`);
      }

      if (errorObj.code === 'CANCELLED') {
        logger.debug(`${this.providerName} API request cancelled`, { endpoint, duration });
        throw errorObj;
      }

      if (this.breaker.opened) {
        logger.error(`${this.providerName} API circuit breaker is open`, errorObj);
        throw new ServiceUnavailableError(`${this.providerName} API is currently unavailable`);
      }

      logger.error(`${this.providerName} API call failed`, {
        endpoint,
        duration,
        error: errorObj.message,
      });
      throw errorObj;
    }
  }

  /**
   * Stream completion with real-time chunks
   */
  async streamComplete(systemPrompt: string, options: StreamCompletionOptions): Promise<string> {
    const startTime = Date.now();

    if (!options.onChunk || typeof options.onChunk !== 'function') {
      throw new Error('onChunk callback is required for streaming');
    }

    // Execute with optional concurrency limiting (critical fix!)
    const executeStream = async (): Promise<string> => {
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

      const errorObj = error as Error & { code?: string };

      // Handle concurrency limiter errors
      if (errorObj.code === 'QUEUE_TIMEOUT') {
        throw new TimeoutError(`${this.providerName} streaming request timed out in queue - system overloaded`);
      }

      if (errorObj.code === 'CANCELLED') {
        logger.debug(`${this.providerName} streaming request cancelled`);
        throw errorObj;
      }

      throw errorObj;
    }
  }

  /**
   * Internal streaming execution with robust SSE parsing
   * @private
   */
  private async _executeStream(systemPrompt: string, options: StreamCompletionOptions, startTime: number): Promise<string> {
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
      const errorObj = error as Error;
      if (errorObj.name === 'AbortError') {
        const timeout = options.timeout || this.defaultTimeout;
        throw new TimeoutError(`${this.providerName} streaming request timeout after ${timeout}ms`);
      }

      logger.error(`${this.providerName} streaming failed`, { error: errorObj.message });
      throw errorObj;
    }
  }

  /**
   * Internal method to make the actual API request (non-streaming)
   * @private
   */
  private async _makeRequest(systemPrompt: string, options: CompletionOptions = {}): Promise<AIResponse> {
    const requestOptions = this._applyDefaults(options);
    return await this.adapter.complete(systemPrompt, requestOptions);
  }

  /**
   * Health check for the API
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      let result: { healthy: boolean; [key: string]: unknown };

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
        responseTime: (result.responseTime as number | undefined) || duration,
        circuitBreakerState: this.getCircuitBreakerState(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        error: errorMessage,
        circuitBreakerState: this.getCircuitBreakerState(),
      };
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): { state: string; stats: unknown } {
    return {
      state: this.getCircuitBreakerState(),
      stats: this.breaker.stats,
    };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): 'OPEN' | 'HALF-OPEN' | 'CLOSED' {
    if (this.breaker.opened) return 'OPEN';
    if (this.breaker.halfOpen) return 'HALF-OPEN';
    return 'CLOSED';
  }

  /**
   * Get concurrency limiter statistics (if available)
   */
  getConcurrencyStats(): unknown {
    return this.concurrencyLimiter?.getStats?.() || null;
  }

  /**
   * Get current queue status (if concurrency limiter available)
   */
  getQueueStatus(): unknown {
    return this.concurrencyLimiter?.getQueueStatus?.() || null;
  }

  /**
   * Get the provider name
   */
  getProvider(): string {
    return this.providerName;
  }

  /**
   * Get the model name being used
   */
  getModel(): string {
    return this.defaultModel;
  }

  /**
   * Apply defaults to request options without mutating the original
   * @private
   */
  private _applyDefaults(options: CompletionOptions = {}): CompletionOptions {
    return {
      ...options,
      model: options.model || this.defaultModel,
      timeout: options.timeout || this.defaultTimeout,
    };
  }
}

