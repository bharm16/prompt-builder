import { APIError, TimeoutError } from '../LLMClient.js';
import { logger } from '../../infrastructure/Logger.js';

/**
 * Adapter for Google Gemini (Generative Language API)
 */
export class GeminiAdapter {
  constructor({
    apiKey,
    baseURL = 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel,
    defaultTimeout = 30000,
    providerName = 'gemini',
  }) {
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
    this.capabilities = { streaming: true };
  }

  async complete(systemPrompt, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);

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
              const content = this._extractTextFromParts(
                parsed.candidates?.[0]?.content?.parts
              );

              if (content) {
                fullText += content;
                options.onChunk(content);
              }
            } catch (e) {
              logger.debug('Skipping malformed Gemini SSE chunk', { chunk: data.substring(0, 100) });
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
        timeout: Math.min(20000, this.defaultTimeout),
        jsonMode: true,
      });

      return { healthy: true, provider: this.providerName };
    } catch (error) {
      return { healthy: false, provider: this.providerName, error: error.message };
    }
  }

  _buildPayload(systemPrompt, options) {
    const { systemInstruction, contents } = this._buildMessages(systemPrompt, options);
    const generationConfig = {
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      maxOutputTokens: options.maxTokens || 2048,
    };

    if (options.jsonMode && !options.isArray) {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload = {
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

  _buildMessages(systemPrompt, options) {
    if (options.messages && Array.isArray(options.messages)) {
      const systemParts = [];
      const contents = [];

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

  _extractTextFromParts(parts) {
    if (!Array.isArray(parts)) return '';
    return parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
  }

  _stringifyContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === 'string' ? c : c?.text || ''))
        .join('');
    }
    if (typeof content === 'object' && content !== null) {
      return content.text || JSON.stringify(content);
    }
    return '';
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
