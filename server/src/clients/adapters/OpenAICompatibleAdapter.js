import { APIError, TimeoutError } from '../LLMClient.js';
import { logger } from '../../infrastructure/Logger.js';

/**
 * Adapter for OpenAI-compatible chat completion APIs
 * (OpenAI, Groq, Together, etc.)
 */
export class OpenAICompatibleAdapter {
  constructor({
    apiKey,
    baseURL,
    defaultModel,
    defaultTimeout = 60000,
    providerName = 'openai',
  }) {
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

  async complete(systemPrompt, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);

    try {
      const messages = this._buildMessages(systemPrompt, options);
      const payload = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
      };

      // PDF Design C: Grammar-constrained decoding with structured outputs
      // If responseFormat is provided (e.g., json_schema), use it directly
      // Otherwise fall back to basic json_object mode if jsonMode is true
      if (options.responseFormat) {
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

      const data = await response.json();
      return this._normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new TimeoutError(`${this.providerName} API request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  async streamComplete(systemPrompt, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);
    let fullText = '';

    try {
      const messages = this._buildMessages(systemPrompt, options);
      const payload = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        stream: true,
      };

      // PDF Design C: Grammar-constrained decoding with structured outputs
      // Note: Streaming with json_schema may not be supported by all providers
      if (options.responseFormat) {
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

      const reader = response.body.getReader();
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
              const parsed = JSON.parse(data);
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

      if (error.name === 'AbortError') {
        throw new TimeoutError(`${this.providerName} streaming request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }

  async healthCheck() {
    try {
      await this.complete('Respond with valid JSON containing: {"status": "healthy"}', {
        maxTokens: 50,
        timeout: Math.min(30000, this.defaultTimeout),
        jsonMode: true,
      });

      return { healthy: true, provider: this.providerName };
    } catch (error) {
      return { healthy: false, provider: this.providerName, error: error.message };
    }
  }

  _normalizeResponse(data) {
    return {
      content: [
        {
          text: data.choices?.[0]?.message?.content || '',
        },
      ],
      usage: data.usage,
      raw: data,
      _original: data, // backward compatibility
    };
  }

  _buildMessages(systemPrompt, options) {
    if (options.messages && Array.isArray(options.messages)) {
      return options.messages;
    }

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: options.userMessage || 'Please proceed.' },
    ];
  }

  _createAbortController(timeout, externalSignal) {
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
