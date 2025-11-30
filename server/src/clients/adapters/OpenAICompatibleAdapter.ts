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
  developerMessage?: string; // GPT-4o Best Practices: Developer role for hard constraints
  enableBookending?: boolean; // GPT-4o Best Practices: Bookending strategy for long prompts
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
      
      // Determine if this is a structured output request
      const isStructuredOutput = !!(options.schema || options.responseFormat || options.jsonMode);
      
      // For structured outputs, use deterministic temperature (0.0-0.2 range per GPT-4o best practices)
      // For creative generation, allow higher temperatures
      const defaultTemp = isStructuredOutput ? 0.0 : 0.7;
      const temperature = options.temperature !== undefined ? options.temperature : defaultTemp;
      
      const payload: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature,
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

      // GPT-4o Best Practices: Set frequency_penalty to 0 for structured outputs
      // Prevents refusal loops caused by penalizing structural tokens ({, }, ", :)
      if (isStructuredOutput) {
        payload.frequency_penalty = 0;
      }

      // GPT-4o Best Practices: Set top_p to 1.0 when temperature is 0 for deterministic output
      if (temperature === 0) {
        payload.top_p = 1.0;
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
      
      // Determine if this is a structured output request
      const isStructuredOutput = !!(options.schema || options.responseFormat || options.jsonMode);
      
      // For structured outputs, use deterministic temperature (0.0-0.2 range per GPT-4o best practices)
      // For creative generation, allow higher temperatures
      const defaultTemp = isStructuredOutput ? 0.0 : 0.7;
      const temperature = options.temperature !== undefined ? options.temperature : defaultTemp;
      
      const payload: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature,
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

      // GPT-4o Best Practices: Set frequency_penalty to 0 for structured outputs
      // Prevents refusal loops caused by penalizing structural tokens ({, }, ", :)
      if (isStructuredOutput) {
        payload.frequency_penalty = 0;
      }

      // GPT-4o Best Practices: Set top_p to 1.0 when temperature is 0 for deterministic output
      if (temperature === 0) {
        payload.top_p = 1.0;
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

  /**
   * Estimate token count (rough approximation: ~4 characters per token)
   * GPT-4o Best Practices: Use bookending for prompts >30k tokens
   */
  private _estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Build messages array with support for developer role and bookending strategy
   * GPT-4o Best Practices:
   * - Developer role for hard constraints (security, schema)
   * - Bookending: Repeat critical instructions at end for long prompts (>30k tokens)
   */
  private _buildMessages(systemPrompt: string, options: CompletionOptions): Array<{ role: string; content: string }> {
    if (options.messages && Array.isArray(options.messages)) {
      const messages: Array<{ role: string; content: string }> = [];
      
      // GPT-4o Best Practices: Developer role for hard constraints (highest priority)
      if (options.developerMessage) {
        messages.push({ role: 'developer', content: options.developerMessage });
      }
      
      // Add existing messages
      messages.push(...options.messages);
      
      // If custom messages provided, still apply bookending if enabled
      if (options.enableBookending) {
        const totalTokens = messages.reduce((sum, msg) => 
          sum + this._estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)), 0
        );
        
        if (totalTokens > 30000) {
          // Find critical instructions from system message
          const systemMsg = messages.find(m => m.role === 'system');
          const criticalInstructions = systemMsg?.content 
            ? this._extractCriticalInstructions(systemMsg.content)
            : 'Remember to follow the format constraints defined in the system message.';
          
          // Append bookending message
          messages.push({ 
            role: 'user', 
            content: `Based on the context above, perform the requested task. ${criticalInstructions}` 
          });
        }
      }
      return messages;
    }

    const messages: Array<{ role: string; content: string }> = [];

    // GPT-4o Best Practices: Developer role for hard constraints (highest priority)
    if (options.developerMessage) {
      messages.push({ role: 'developer', content: options.developerMessage });
    }

    // System message (immutable sovereign)
    messages.push({ role: 'system', content: systemPrompt });

    // User message
    const userMessage = options.userMessage || 'Please proceed.';
    messages.push({ role: 'user', content: userMessage });

    // GPT-4o Best Practices: Bookending strategy for long prompts
    if (options.enableBookending) {
      const totalTokens = this._estimateTokens(systemPrompt + userMessage);
      if (totalTokens > 30000) {
        const criticalInstructions = this._extractCriticalInstructions(systemPrompt);
        messages.push({
          role: 'user',
          content: `Based on the context above, perform the requested task. ${criticalInstructions}`
        });
      }
    }

    return messages;
  }

  /**
   * Extract critical instructions from system prompt for bookending
   * Looks for format constraints, output requirements, and validation rules
   */
  private _extractCriticalInstructions(systemPrompt: string): string {
    const criticalPatterns = [
      /respond\s+only\s+with\s+valid\s+json/i,
      /output\s+only\s+valid\s+json/i,
      /no\s+markdown/i,
      /follow\s+the\s+format\s+constraints/i,
      /required\s+fields/i,
      /validation\s+requirements/i,
    ];

    const matches: string[] = [];
    for (const pattern of criticalPatterns) {
      const match = systemPrompt.match(pattern);
      if (match) {
        // Extract surrounding context (up to 100 chars)
        const index = systemPrompt.indexOf(match[0]);
        const start = Math.max(0, index - 50);
        const end = Math.min(systemPrompt.length, index + match[0].length + 50);
        matches.push(systemPrompt.substring(start, end).trim());
      }
    }

    if (matches.length > 0) {
      return matches[0]; // Return first critical instruction found
    }

    // Fallback: Generic reminder
    return 'Remember to follow the format constraints defined in the system message.';
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

