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
  }

  async complete(systemPrompt: string, options: CompletionOptions = {}): Promise<AIResponse> {
    const startTime = performance.now();
    const operation = 'complete';
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId, abortedByTimeout } = this._createAbortController(timeout, options.signal);

    this.log.debug(`Starting ${operation}`, {
      operation,
      model: options.model || this.defaultModel,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
    });

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

        this.log.warn('Gemini API request failed', {
          operation,
          status: response.status,
          isRetryable,
          error: errorBody.substring(0, 200),
        });

        throw apiError;
      }

      const data = (await response.json()) as GeminiResponse;
      const result = this.responseParser.parseResponse(data);

      this.log.info(`${operation} completed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
        responseLength: result.text?.length || 0,
        model: options.model || this.defaultModel,
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw this._handleError(error, abortedByTimeout, timeout, operation, startTime);
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

    this.log.error(`${operation} failed`, errorObj, {
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
