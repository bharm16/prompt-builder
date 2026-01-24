/**
 * GeminiAdapter - HTTP transport layer for Google Gemini API
 *
 * Single Responsibility: Handle HTTP communication with Gemini API.
 * Delegates message building and response parsing to specialized classes.
 *
 * Changes when: API endpoints, authentication, or HTTP patterns change.
 */

import { APIError, TimeoutError, ClientAbortError } from '../LLMClient.ts';
import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import CircuitBreaker from 'opossum';
import { GeminiMessageBuilder } from './gemini/GeminiMessageBuilder.ts';
import { GeminiResponseParser } from './gemini/GeminiResponseParser.ts';
import type {
  CompletionOptions,
  AdapterConfig,
  AbortControllerResult,
  GeminiResponse,
  AIResponse,
} from './gemini/types.ts';

export class GeminiAdapter {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private defaultTimeout: number;
  private providerName: string;
  private readonly log: ILogger;
  private readonly messageBuilder: GeminiMessageBuilder;
  private readonly responseParser: GeminiResponseParser;
  public capabilities: { streaming: boolean };
  private breaker: CircuitBreaker;

  constructor({
    apiKey,
    baseURL = 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel,
    defaultTimeout = 30000,
    providerName = 'gemini',
  }: AdapterConfig) {
    if (!apiKey) {
      throw new Error(`API key required for ${providerName}`);
    }
    if (!defaultModel) {
      throw new Error(`Default model required for ${providerName}`);
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, '');
    this.defaultModel = defaultModel;
    this.defaultTimeout = defaultTimeout;
    this.providerName = providerName;
    this.log = logger.child({ service: 'GeminiAdapter' });
    this.messageBuilder = new GeminiMessageBuilder();
    this.responseParser = new GeminiResponseParser();
    this.capabilities = { streaming: true };

    // Initialize Circuit Breaker
    this.breaker = new CircuitBreaker(this._executeRequest.bind(this), {
      timeout: this.defaultTimeout + 5000, // Slightly higher than internal timeout
      errorThresholdPercentage: 50,
      resetTimeout: 10000, // Wait 10s before retrying after open
      name: 'GeminiAPI',
    });

    this.breaker.fallback(() => {
      throw new APIError('Gemini API Circuit Breaker Open', 503, true);
    });

    this.breaker.on('open', () => this.log.warn('Gemini Circuit Breaker OPENED'));
    this.breaker.on('halfOpen', () => this.log.info('Gemini Circuit Breaker HALF-OPEN'));
    this.breaker.on('close', () => this.log.info('Gemini Circuit Breaker CLOSED'));
  }

  /**
   * Internal method to execute the request, wrapped by Circuit Breaker
   */
  private async _executeRequest(
    systemPrompt: string,
    options: CompletionOptions
  ): Promise<AIResponse> {
    const operation = 'complete';
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId, abortedByTimeout } = this._createAbortController(
      timeout,
      options.signal
    );

    try {
      const payload = this.messageBuilder.buildPayload(systemPrompt, options);
      const model = encodeURIComponent(options.model || this.defaultModel);

      const response = await fetch(`${this.baseURL}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const isRetryable = response.status >= 500 || response.status === 429;
        const apiError = new APIError(
          `${this.providerName} API error: ${response.status} - ${errorBody}`,
          response.status,
          isRetryable
        );

        // Don't trip breaker for 4xx errors (except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw apiError; // Will be caught below but we might want to suppress breaker failure
        }

        throw apiError;
      }

      const data = (await response.json()) as GeminiResponse;
      const result = this.responseParser.parseResponse(data);

      this.log.info('Operation completed.', {
        operation,
        responseLength: result.text?.length || 0,
        model: options.model || this.defaultModel,
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw this._handleError(error, abortedByTimeout, timeout, operation, performance.now());
    }
  }

  async complete(systemPrompt: string, options: CompletionOptions = {}): Promise<AIResponse> {
    const startTime = performance.now();
    const operation = 'complete';
    
    this.log.debug('Starting operation.', {
      operation,
      model: options.model || this.defaultModel,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
    });

    // Map IAIClient 'schema' to Gemini 'responseSchema' if present
    if (options.schema && !options.responseSchema) {
      options.responseSchema = options.schema;
    }

    // Fire the circuit breaker
    try {
      return await this.breaker.fire(systemPrompt, options) as AIResponse;
    } catch (error) {
       // If it's a 4xx error that we allowed through, re-throw it. 
       // If it's the breaker open error, let it bubble.
       throw error;
    }
  }

  async streamComplete(
    systemPrompt: string,
    options: CompletionOptions & { onChunk: (chunk: string) => void }
  ): Promise<string> {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId, abortedByTimeout } = this._createAbortController(timeout, options.signal);
    let fullText = '';

    try {
      const payload = this.messageBuilder.buildPayload(systemPrompt, options);
      const model = encodeURIComponent(options.model || this.defaultModel);

      const response = await fetch(`${this.baseURL}/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        const isRetryable = response.status >= 500 || response.status === 429;
        throw new APIError(
          `${this.providerName} API error: ${response.status} - ${errorBody}`,
          response.status,
          isRetryable
        );
      }

      fullText = await this._processStream(response, options.onChunk);
      return fullText;
    } catch (error) {
      clearTimeout(timeoutId);

      const errorObj = error as Error;
      if (errorObj.name === 'AbortError') {
        if (abortedByTimeout.value) {
          throw new TimeoutError(`${this.providerName} streaming request timeout after ${timeout}ms`);
        }
        throw new ClientAbortError(`${this.providerName} streaming request aborted by client`);
      }

      throw errorObj;
    }
  }

  async generateText(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const response = await this.complete(prompt, options);
    return response.text || '';
  }

  async generateStructuredOutput(prompt: string, schema: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.complete(prompt, {
      responseSchema: schema,
      jsonMode: true,
      maxTokens: 2048, // Ensure enough tokens for JSON
    });

    if (!response.text) {
      throw new Error('Empty response from Gemini for structured output');
    }

    try {
      return JSON.parse(response.text);
    } catch (e) {
      this.log.error('Failed to parse structured output', e as Error, { text: response.text });
      throw new Error('Invalid JSON response from Gemini');
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; provider: string; error?: string }> {
    try {
      await this.complete('Respond with valid JSON containing: {"status": "healthy"}', {
        maxTokens: 50,
        timeout: Math.min(20000, this.defaultTimeout),
        jsonMode: true,
      });

      return { healthy: true, provider: this.providerName };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { healthy: false, provider: this.providerName, error: errorMessage };
    }
  }

  /**
   * Process SSE stream from Gemini API
   */
  private async _processStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        // Standard Gemini SSE format
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as GeminiResponse;
            const content = this.responseParser.extractTextFromParts(
              parsed.candidates?.[0]?.content?.parts
            );

            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch {
            // If it fails to parse as JSON, treat it as raw text if it's not structural
            // This is a fallback for some edge cases in Gemini's stream
             this.log.debug('Skipping malformed Gemini SSE chunk', {
              operation: 'streamComplete',
              chunk: data.substring(0, 100),
            });
          }
        } else {
             // Fallback: Sometimes content comes without "data:" prefix in raw streams
             // Attempt to parse as direct JSON if it looks like it
             try {
                const parsed = JSON.parse(trimmed) as GeminiResponse;
                 const content = this.responseParser.extractTextFromParts(
                  parsed.candidates?.[0]?.content?.parts
                );
                if (content) {
                  fullText += content;
                  onChunk(content);
                }
             } catch {
                // Ignore truly non-JSON lines (noise)
             }
        }
      }
    }

    return fullText;
  }

  /**
   * Handle errors from API calls, distinguishing timeout from client abort
   */
  private _handleError(
    error: unknown,
    abortedByTimeout: { value: boolean },
    timeout: number,
    operation: string,
    startTime: number
  ): Error {
    const errorObj = error as Error;

    if (errorObj.name === 'AbortError') {
      if (abortedByTimeout.value) {
        const timeoutError = new TimeoutError(`${this.providerName} API request timeout after ${timeout}ms`);
        this.log.warn('Gemini API request timeout', { operation, timeout });
        return timeoutError;
      }

      const clientAbortError = new ClientAbortError(`${this.providerName} API request aborted by client`);
      this.log.debug('Gemini API request aborted by client', { operation });
      return clientAbortError;
    }

    this.log.error('Operation failed.', errorObj, {
      operation,
      duration: Math.round(performance.now() - startTime),
    });

    return errorObj;
  }

  /**
   * Create an abort controller with timeout support
   */
  private _createAbortController(timeout: number, externalSignal?: AbortSignal): AbortControllerResult {
    const controller = new AbortController();
    const abortedByTimeout = { value: false };

    const timeoutId = setTimeout(() => {
      abortedByTimeout.value = true;
      controller.abort();
    }, timeout);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    return { controller, timeoutId, abortedByTimeout };
  }
}

// Re-export types for consumers who import from adapter file
export type { CompletionOptions, AdapterConfig, AIResponse } from './gemini/types.ts';
