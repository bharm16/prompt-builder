/**
 * OpenAI Compatible Adapter (GPT-4o Optimized)
 * 
 * Implements GPT-4o API best practices from:
 * "Optimal Prompt Architecture and API Implementation Strategies for GPT-4o"
 * 
 * Key GPT-4o Optimizations:
 * - Temperature 0.0 for structured output (deterministic)
 * - top_p 1.0 when temperature is 0 (per API docs)
 * - frequency_penalty 0 for JSON (structural tokens must repeat)
 * - Developer role for hard constraints (highest priority)
 * - Bookending strategy for long prompts (>30k tokens)
 * - Native Structured Outputs (json_schema strict mode)
 * 
 * Additional Optimizations:
 * - Seed parameter for reproducibility and caching
 * - Logprobs for token-level confidence
 * - Predicted outputs for faster structured responses
 * - Response validation with automatic retry
 */

import { APIError, TimeoutError } from '../LLMClient.ts';
import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import type { AIResponse } from '@interfaces/IAIClient';
import { validateLLMResponse, ValidationResult } from './ResponseValidator.js';

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
  seed?: number; // Reproducibility: Same seed + input = deterministic output
  logprobs?: boolean; // Token-level confidence (more reliable than self-reported)
  topLogprobs?: number; // Number of top logprobs to return (1-5, max 20 for OpenAI)
  prediction?: { // Predicted Outputs: Speed up structured responses
    type: 'content';
    content: string; // Expected output structure (partial match)
  };
  retryOnValidationFailure?: boolean; // Auto-retry on malformed response
  maxRetries?: number; // Max retry attempts (default: 2)
  store?: boolean; // Whether to store the completion for distillation
  streamOptions?: { include_usage?: boolean }; // Stream options
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

interface LogprobInfo {
  token: string;
  logprob: number;
  probability: number;
}

interface OpenAIResponseData {
  choices?: Array<{
    message?: { content?: string };
    logprobs?: {
      content?: Array<{
        token: string;
        logprob: number;
        top_logprobs?: Array<{ token: string; logprob: number }>;
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: unknown;
  system_fingerprint?: string;
  id?: string;
  model?: string;
}

/**
 * Adapter for OpenAI-compatible chat completion APIs
 * (OpenAI, Azure OpenAI, etc.)
 * 
 * Note: For Groq/Llama 3, use GroqLlamaAdapter instead
 * (different temperature, penalties, and optimizations)
 */
export class OpenAICompatibleAdapter {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private defaultTimeout: number;
  private providerName: string;
  private readonly log: ILogger;
  public capabilities: { 
    streaming: boolean; 
    logprobs: boolean; 
    seed: boolean;
    predictedOutputs: boolean;
    developerRole: boolean;
    structuredOutputs: boolean;
  };

  constructor({
    apiKey,
    baseURL,
    defaultModel,
    defaultTimeout = 60000,
    providerName = 'openai',
  }: AdapterConfig) {
    this.log = logger.child({ service: 'OpenAICompatibleAdapter', provider: providerName });
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
    this.capabilities = { 
      streaming: true,
      logprobs: true,
      seed: true,
      predictedOutputs: providerName === 'openai', // Only OpenAI supports this
      developerRole: true,
      structuredOutputs: true,
    };
  }

  /**
   * Complete a chat request with GPT-4o optimizations
   */
  async complete(systemPrompt: string, options: CompletionOptions = {}): Promise<AIResponse> {
    const startTime = performance.now();
    const operation = 'complete';
    const maxRetries = options.maxRetries ?? 2;
    const shouldRetry = options.retryOnValidationFailure ?? true;
    let lastError: Error | null = null;
    let attempt = 0;

    this.log.debug(`Starting ${operation}`, {
      operation,
      model: options.model || this.defaultModel,
      maxTokens: options.maxTokens,
      hasSchema: !!options.schema,
      jsonMode: options.jsonMode,
      attempt: attempt + 1,
    });

    while (attempt <= maxRetries) {
      try {
        const response = await this._executeRequest(systemPrompt, options, attempt);
        
        // Validate response if JSON mode is enabled
        if (options.jsonMode || options.schema || options.responseFormat) {
          const validation = validateLLMResponse(response.text, {
            expectJson: true,
            ...(options.isArray !== undefined && { expectArray: options.isArray }),
          });

          if (!validation.isValid) {
            if (shouldRetry && attempt < maxRetries) {
              this.log.warn('OpenAI response validation failed, retrying', {
                operation,
                attempt: attempt + 1,
                errors: validation.errors,
                responsePreview: response.text.substring(0, 200),
              });
              attempt++;
              continue;
            }
            
            response.metadata.validation = validation;
          } else {
            response.metadata.validation = validation;
          }
        }

        this.log.info(`${operation} completed`, {
          operation,
          duration: Math.round(performance.now() - startTime),
          attempt: attempt + 1,
          responseLength: response.text?.length || 0,
          model: options.model || this.defaultModel,
        });

        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof APIError && error.isRetryable && attempt < maxRetries) {
          this.log.warn('OpenAI API error, retrying', {
            operation,
            attempt: attempt + 1,
            status: error.statusCode,
            error: error.message,
          });
          attempt++;
          await this._sleep(Math.pow(2, attempt) * 500);
          continue;
        }
        
        this.log.error(`${operation} failed`, error as Error, {
          operation,
          duration: Math.round(performance.now() - startTime),
          attempt: attempt + 1,
          maxRetries,
        });
        
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Execute a single request (internal, supports retry logic)
   */
  private async _executeRequest(
    systemPrompt: string, 
    options: CompletionOptions,
    attempt: number = 0
  ): Promise<AIResponse> {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);

    try {
      const messages = this._buildMessages(systemPrompt, options);
      
      // Determine if this is a structured output request
      const isStructuredOutput = !!(options.schema || options.responseFormat || options.jsonMode);
      
      // GPT-4o: Temperature 0.0 for structured outputs (fully deterministic)
      const defaultTemp = isStructuredOutput ? 0.0 : 0.7;
      const temperature = options.temperature !== undefined ? options.temperature : defaultTemp;
      
      const payload: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature,
      };

      /**
       * Seed Parameter: Reproducibility & Caching
       * 
       * OpenAI's seed parameter enables deterministic outputs.
       * Combined with system_fingerprint, can verify identical generations.
       */
      if (options.seed !== undefined) {
        payload.seed = options.seed;
      } else if (isStructuredOutput) {
        // Default seed for structured outputs
        payload.seed = this._hashString(systemPrompt) % 2147483647;
      }

      /**
       * Logprobs: Token-level Confidence
       */
      if (options.logprobs) {
        payload.logprobs = true;
        payload.top_logprobs = Math.min(options.topLogprobs ?? 3, 20); // OpenAI max is 20
      }

      /**
       * Predicted Outputs: Faster Structured Responses
       * 
       * OpenAI's prediction parameter lets you specify expected output structure.
       * The API can generate matching content up to 50% faster.
       * 
       * Best for: Structured outputs where format is known in advance
       */
      if (options.prediction && this.capabilities.predictedOutputs) {
        payload.prediction = options.prediction;
      }

      // Native Structured Outputs: Support strict json_schema mode
      if (options.schema) {
        payload.response_format = {
          type: "json_schema",
          json_schema: {
            name: "structured_response",
            strict: true,
            schema: options.schema
          }
        };
      } else if (options.responseFormat) {
        payload.response_format = options.responseFormat;
      } else if (options.jsonMode && !options.isArray) {
        payload.response_format = { type: 'json_object' };
      }

      // GPT-4o: Set frequency_penalty to 0 for structured outputs
      if (isStructuredOutput) {
        payload.frequency_penalty = 0;
      }

      // GPT-4o: Set top_p to 1.0 when temperature is 0 for deterministic output
      if (temperature === 0) {
        payload.top_p = 1.0;
      }

      // Optional: Store completion for distillation/fine-tuning
      if (options.store !== undefined) {
        payload.store = options.store;
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
        const apiError = new APIError(
          `${this.providerName} API error: ${response.status} - ${errorBody}`,
          response.status,
          isRetryable
        );
        
        this.log.warn('OpenAI API request failed', {
          operation: '_executeRequest',
          status: response.status,
          isRetryable,
          error: errorBody.substring(0, 200),
        });
        
        throw apiError;
      }

      const data = await response.json() as OpenAIResponseData;
      return this._normalizeResponse(data, options);
    } catch (error) {
      clearTimeout(timeoutId);

      const errorObj = error as Error;
      if (errorObj.name === 'AbortError') {
        const timeoutError = new TimeoutError(`${this.providerName} API request timeout after ${timeout}ms`);
        this.log.warn('OpenAI API request timeout', {
          operation: '_executeRequest',
          timeout,
        });
        throw timeoutError;
      }

      this.log.error('OpenAI API request error', errorObj, {
        operation: '_executeRequest',
      });

      throw errorObj;
    }
  }

  async streamComplete(
    systemPrompt: string, 
    options: CompletionOptions & { onChunk: (chunk: string) => void }
  ): Promise<string> {
    const timeout = options.timeout || this.defaultTimeout;
    const { controller, timeoutId } = this._createAbortController(timeout, options.signal);
    let fullText = '';

    try {
      const messages = this._buildMessages(systemPrompt, options);
      
      const isStructuredOutput = !!(options.schema || options.responseFormat || options.jsonMode);
      const defaultTemp = isStructuredOutput ? 0.0 : 0.7;
      const temperature = options.temperature !== undefined ? options.temperature : defaultTemp;
      
      const payload: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature,
        stream: true,
      };

      // Seed for reproducibility
      if (options.seed !== undefined) {
        payload.seed = options.seed;
      } else if (isStructuredOutput) {
        payload.seed = this._hashString(systemPrompt) % 2147483647;
      }

      // Stream options for usage info
      if (options.streamOptions) {
        payload.stream_options = options.streamOptions;
      }

      // Response format
      if (options.schema) {
        payload.response_format = {
          type: "json_schema",
          json_schema: {
            name: "structured_response",
            strict: true,
            schema: options.schema
          }
        };
      } else if (options.responseFormat) {
        payload.response_format = options.responseFormat;
      } else if (options.jsonMode && !options.isArray) {
        payload.response_format = { type: 'json_object' };
      }

      if (isStructuredOutput) {
        payload.frequency_penalty = 0;
      }

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
        retryOnValidationFailure: false,
      });

      return { healthy: true, provider: this.providerName };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { healthy: false, provider: this.providerName, error: errorMessage };
    }
  }

  /**
   * Normalize response with enhanced metadata
   */
  private _normalizeResponse(data: OpenAIResponseData, options: CompletionOptions): AIResponse {
    const text = data.choices?.[0]?.message?.content || '';

    // Extract logprobs for confidence scoring
    let logprobsInfo: LogprobInfo[] | undefined;
    let averageConfidence: number | undefined;
    
    if (options.logprobs && data.choices?.[0]?.logprobs?.content) {
      logprobsInfo = data.choices[0].logprobs.content.map(item => ({
        token: item.token,
        logprob: item.logprob,
        probability: Math.exp(item.logprob),
      }));
      
      if (logprobsInfo.length > 0) {
        const sum = logprobsInfo.reduce((acc, item) => acc + item.probability, 0);
        averageConfidence = sum / logprobsInfo.length;
      }
    }

    const optimizations: string[] = [];
    if (options.schema) optimizations.push('structured-outputs-strict');
    if (options.developerMessage) optimizations.push('developer-role');
    if (options.enableBookending) optimizations.push('bookending');
    if (options.seed !== undefined) optimizations.push('seed-deterministic');
    if (options.logprobs) optimizations.push('logprobs-confidence');
    if (options.prediction) optimizations.push('predicted-outputs');

    const metadata = {
      usage: data.usage,
      raw: data,
      _original: data,
      provider: this.providerName,
      optimizations,
      ...(data.model ? { model: data.model } : {}),
      ...(data.choices?.[0]?.finish_reason ? { finishReason: data.choices[0].finish_reason } : {}),
      ...(data.system_fingerprint ? { systemFingerprint: data.system_fingerprint } : {}),
      ...(data.id ? { requestId: data.id } : {}),
      ...(logprobsInfo ? { logprobs: logprobsInfo } : {}),
      ...(typeof averageConfidence === 'number' ? { averageConfidence } : {}),
    };

    return {
      text,
      metadata,
    };
  }

  /**
   * Estimate token count (rough approximation: ~4 characters per token)
   */
  private _estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Build messages array with GPT-4o optimizations
   */
  private _buildMessages(
    systemPrompt: string, 
    options: CompletionOptions
  ): Array<{ role: string; content: string }> {
    if (options.messages && Array.isArray(options.messages)) {
      const messages: Array<{ role: string; content: string }> = [];
      
      // GPT-4o: Developer role for hard constraints (highest priority)
      if (options.developerMessage) {
        messages.push({ role: 'developer', content: options.developerMessage });
      }
      
      messages.push(...options.messages);
      
      // Apply bookending if enabled
      if (options.enableBookending) {
        const totalTokens = messages.reduce((sum, msg) => 
          sum + this._estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)), 0
        );
        
        if (totalTokens > 30000) {
          const systemMsg = messages.find(m => m.role === 'system');
          const criticalInstructions = systemMsg?.content 
            ? this._extractCriticalInstructions(systemMsg.content)
            : 'Remember to follow the format constraints defined in the system message.';
          
          messages.push({ 
            role: 'user', 
            content: `Based on the context above, perform the requested task. ${criticalInstructions}` 
          });
        }
      }
      return messages;
    }

    const messages: Array<{ role: string; content: string }> = [];

    // Developer role for hard constraints
    if (options.developerMessage) {
      messages.push({ role: 'developer', content: options.developerMessage });
    }

    // System message
    messages.push({ role: 'system', content: systemPrompt });

    // User message
    const userMessage = options.userMessage || 'Please proceed.';
    messages.push({ role: 'user', content: userMessage });

    // Bookending for long prompts
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
        const index = systemPrompt.indexOf(match[0]);
        const start = Math.max(0, index - 50);
        const end = Math.min(systemPrompt.length, index + match[0].length + 50);
        matches.push(systemPrompt.substring(start, end).trim());
      }
    }

    if (matches.length > 0) {
      const firstMatch = matches[0];
      if (firstMatch) {
        return firstMatch;
      }
    }

    return 'Remember to follow the format constraints defined in the system message.';
  }

  /**
   * Simple string hash for seed generation
   */
  private _hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
