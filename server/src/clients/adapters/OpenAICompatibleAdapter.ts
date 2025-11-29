import { APIError, TimeoutError } from '../LLMClient.ts';
import { logger } from '@infrastructure/Logger';
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
  responseFormat?: { type: string; [key: string]: unknown };
  schema?: Record<string, unknown>;
  messages?: Array<{ role: string; content: string }>;
  onChunk?: (chunk: string) => void;
}

interface AdapterConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  defaultTimeout?: number;
  providerName?: string;
}

interface AbortControllerResult {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
}

/**
 * Adapter for OpenAI-compatible chat completion APIs
 * (OpenAI, Groq, Together, etc.)
 */
export class OpenAICompatibleAdapter {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private defaultTimeout: number;
  private providerName: string;
  public capabilities: { streaming: boolean };

  constructor({
    apiKey,
    baseURL,
    defaultModel,
    defaultTimeout = 60000,
    providerName = 'openai',
  }: AdapterConfig) {
    if (!apiKey) {
      throw new Error(`API key required for ${providerName}`);
    }
    if (!baseURL) {
      throw new Error(`Base URL required for ${providerName}`);
    }
    if (!defaultModel) {
      throw new Error(`Default model required for ${providerName}`);
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, '');
    this.defaultModel = defaultModel;
    this.defaultTimeout = defaultTimeout;
    this.providerName = providerName;
    this.capabilities = { streaming: true };
  }

  async complete(systemPrompt: string, options: CompletionOptions = {}): Promise<AIResponse> {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);

    try {
      const messages = this._buildMessages(systemPrompt, options);
      const payload: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
      };

      // Native Structured Outputs: Support strict json_schema mode
      // Priority: schema > responseFormat > jsonMode
      if (options.schema) {
        payload.response_format = {
          type: "json_schema",
          json_schema: {
            name: "video_prompt_response",
            strict: true,
            schema: options.schema
          }
        };
      } else if (options.responseFormat) {
        payload.response_format = options.responseFormat;
      } else if (options.jsonMode && !options.isArray) {
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
        const isRetryable = response.status >= 500 || response.status === 429;
        throw new APIError(
          `${this.providerName} API error: ${response.status} - ${errorBody}`,
          response.status,
          isRetryable
        );
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: unknown;
      };
      return this._normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      const errorObj = error as Error;
      if (errorObj.name === 'AbortError') {
        throw new TimeoutError(`${this.providerName} API request timeout after ${timeout}ms`);
      }

      throw errorObj;
    }
  }

  async streamComplete(systemPrompt: string, options: CompletionOptions & { onChunk: (chunk: string) => void }): Promise<string> {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);
    let fullText = '';

    try {
      const messages = this._buildMessages(systemPrompt, options);
      const payload: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        stream: true,
      };

      // Native Structured Outputs: Support strict json_schema mode
      // Note: Streaming with json_schema may not be supported by all providers
      // Priority: schema > responseFormat > jsonMode
      if (options.schema) {
        payload.response_format = {
          type: "json_schema",
          json_schema: {
            name: "video_prompt_response",
            strict: true,
            schema: options.schema
          }
        };
      } else if (options.responseFormat) {
        payload.response_format = options.responseFormat;
      } else if (options.jsonMode && !options.isArray) {
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
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                fullText += content;
                options.onChunk(content);
              }
            } catch (e) {
              logger.debug('Skipping malformed SSE chunk', { chunk: data.substring(0, 100) });
            }
          }
        }
      }

      return fullText;
    } catch (error) {
      clearTimeout(timeoutId);

      const errorObj = error as Error;
      if (errorObj.name === 'AbortError') {
        throw new TimeoutError(`${this.providerName} streaming request timeout after ${timeout}ms`);
      }

      throw errorObj;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; provider: string; error?: string }> {
    try {
      await this.complete('Respond with valid JSON containing: {"status": "healthy"}', {
        maxTokens: 50,
        timeout: Math.min(30000, this.defaultTimeout),
        jsonMode: true,
      });

      return { healthy: true, provider: this.providerName };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { healthy: false, provider: this.providerName, error: errorMessage };
    }
  }


  private _normalizeResponse(data: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  }): AIResponse {
    return {
      text: data.choices?.[0]?.message?.content || '',
      metadata: {
        usage: data.usage,
        raw: data,
        _original: data, // backward compatibility
      },
    };
  }

  private _buildMessages(systemPrompt: string, options: CompletionOptions): Array<{ role: string; content: string }> {
    if (options.messages && Array.isArray(options.messages)) {
      return options.messages;
    }

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: options.userMessage || 'Please proceed.' },
    ];
  }

  private _createAbortController(timeout: number, externalSignal?: AbortSignal): AbortControllerResult {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    return { controller, timeoutId };
  }
}

