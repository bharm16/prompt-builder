import { APIError, TimeoutError, ClientAbortError } from '../LLMClient.ts';
import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import type { AIResponse } from '@interfaces/IAIClient';

interface CompletionOptions {
  userMessage?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  signal?: AbortSignal;
  jsonMode?: boolean;
  isArray?: boolean;
  messages?: Array<{ role: string; content: string | unknown }>;
  onChunk?: (chunk: string) => void;
}

interface AdapterConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel: string;
  defaultTimeout?: number;
  providerName?: string;
}

interface AbortControllerResult {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
  abortedByTimeout: { value: boolean };
}

interface GeminiPayload {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Adapter for Google Gemini (Generative Language API)
 */
export class GeminiAdapter {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private defaultTimeout: number;
  private providerName: string;
  private readonly log: ILogger;
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
      const payload = this._buildPayload(systemPrompt, options);
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

      const data = await response.json() as GeminiResponse;
      const result = this._normalizeResponse(data);
      
      this.log.info(`${operation} completed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
        responseLength: result.text?.length || 0,
        model: options.model || this.defaultModel,
      });
      
      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      const errorObj = error as Error;
      if (errorObj.name === 'AbortError') {
        if (abortedByTimeout.value) {
          const timeoutError = new TimeoutError(`${this.providerName} API request timeout after ${timeout}ms`);
          this.log.warn('Gemini API request timeout', {
            operation,
            timeout,
          });
          throw timeoutError;
        }

        const clientAbortError = new ClientAbortError(`${this.providerName} API request aborted by client`);
        this.log.debug('Gemini API request aborted by client', {
          operation,
        });
        throw clientAbortError;
      }

      this.log.error(`${operation} failed`, errorObj, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });

      throw errorObj;
    }
  }

  async streamComplete(systemPrompt: string, options: CompletionOptions & { onChunk: (chunk: string) => void }): Promise<string> {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId, abortedByTimeout } = this._createAbortController(timeout, options.signal);
    let fullText = '';

    try {
      const payload = this._buildPayload(systemPrompt, options);
      const model = encodeURIComponent(options.model || this.defaultModel);
      const response = await fetch(
        `${this.baseURL}/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

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

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as GeminiResponse;
              const content = this._extractTextFromParts(
                parsed.candidates?.[0]?.content?.parts
              );

              if (content) {
                fullText += content;
                options.onChunk(content);
              }
            } catch (e) {
              this.log.debug('Skipping malformed Gemini SSE chunk', {
                operation: 'streamComplete',
                chunk: data.substring(0, 100),
              });
            }
          }
        }
      }

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


  private _buildPayload(systemPrompt: string, options: CompletionOptions): GeminiPayload {
    const { systemInstruction, contents } = this._buildMessages(systemPrompt, options);
    const generationConfig: GeminiPayload['generationConfig'] = {
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      maxOutputTokens: options.maxTokens || 2048,
    };

    if (options.jsonMode && !options.isArray) {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload: GeminiPayload = {
      contents,
      generationConfig,
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    return payload;
  }

  private _buildMessages(systemPrompt: string, options: CompletionOptions): {
    systemInstruction: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  } {
    if (options.messages && Array.isArray(options.messages)) {
      const systemParts: string[] = [];
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      for (const message of options.messages) {
        if (message.role === 'system') {
          if (message.content) {
            systemParts.push(
              typeof message.content === 'string'
                ? message.content
                : this._stringifyContent(message.content)
            );
          }
          continue;
        }

        const role = message.role === 'assistant' ? 'model' : 'user';
        const text = typeof message.content === 'string'
          ? message.content
          : this._stringifyContent(message.content);

        contents.push({
          role,
          parts: [{ text }],
        });
      }

      return {
        systemInstruction: systemParts.join('\n').trim() || systemPrompt,
        contents: contents.length ? contents : [
          { role: 'user', parts: [{ text: options.userMessage || 'Please proceed.' }] },
        ],
      };
    }

    return {
      systemInstruction: systemPrompt,
      contents: [
        {
          role: 'user',
          parts: [{ text: options.userMessage || 'Please proceed.' }],
        },
      ],
    };
  }

  private _extractTextFromParts(parts?: Array<{ text?: string }>): string {
    if (!Array.isArray(parts)) return '';
    return parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
  }

  private _stringifyContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === 'string' ? c : (c as { text?: string })?.text || ''))
        .join('');
    }
    if (typeof content === 'object' && content !== null) {
      return (content as { text?: string }).text || JSON.stringify(content);
    }
    return '';
  }

  private _normalizeResponse(data: GeminiResponse): AIResponse {
    const text = this._extractTextFromParts(data.candidates?.[0]?.content?.parts);
    return {
      text,
      metadata: {
        raw: data,
      },
    };
  }

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
