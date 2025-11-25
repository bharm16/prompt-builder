import { logger } from '../../infrastructure/Logger.js';
import { ModelConfig, DEFAULT_CONFIG } from '../../config/modelConfig.js';
import type { IAIClient, AIResponse, CompletionOptions } from '../../interfaces/IAIClient.js';

/**
 * AI Model Service - Unified Router for LLM Operations
 * 
 * This service decouples business logic from specific LLM providers by routing
 * operations through a centralized configuration layer.
 * 
 * Architecture: Dead Simple Router Pattern
 * - Services specify WHAT they want (operation name)
 * - Router decides HOW to execute it (which client/model)
 * - Configuration enables zero-code provider switching
 * 
 * Key Features:
 * - Operation-based routing (not client-based)
 * - Automatic fallback support
 * - Streaming support for real-time UI
 * - Environment variable overrides
 * - Circuit breaker awareness
 * 
 * Design Principles:
 * - Constructor dependency injection (testable)
 * - No module-level state
 * - Adapter pattern for client normalization
 * - Fail-fast with clear error messages
 * 
 * @example
 * // In service constructor
 * constructor(aiService) {
 *   this.ai = aiService;
 * }
 * 
 * // In service method
 * const response = await this.ai.execute('optimize_standard', {
 *   systemPrompt: '...',
 *   userMessage: '...',
 *   temperature: 0.7
 * });
 */

interface ClientsMap {
  openai: IAIClient | null;
  groq?: IAIClient | null;
  gemini?: IAIClient | null;
  [key: string]: IAIClient | null | undefined;
}

interface ExecuteParams extends CompletionOptions {
  systemPrompt: string;
  userMessage?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  jsonMode?: boolean;
  responseFormat?: { type: string; [key: string]: unknown };
  signal?: AbortSignal;
  priority?: boolean;
}

interface StreamParams extends Omit<ExecuteParams, 'responseFormat'> {
  onChunk: (chunk: string) => void;
}

interface ModelConfigEntry {
  client: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  fallbackTo?: string;
  fallbackConfig?: {
    model: string;
    timeout: number;
  };
  responseFormat?: 'json_object';
}

interface RequestOptions extends CompletionOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  jsonMode: boolean;
  responseFormat?: { type: string; [key: string]: unknown };
}

export class AIModelService {
  private readonly clients: ClientsMap;

  /**
   * Create AI Model Service
   * @param params - Constructor parameters
   * @param params.clients - Map of available clients
   * @param params.clients.openai - OpenAI API client
   * @param params.clients.groq - Groq API client (optional)
   */
  constructor({ clients }: { clients: ClientsMap }) {
    if (!clients || typeof clients !== 'object') {
      throw new Error('AIModelService requires clients object');
    }

    if (!clients.openai) {
      throw new Error('AIModelService requires at least openai client');
    }

    this.clients = clients;
    
    logger.info('AIModelService initialized', {
      availableClients: Object.keys(clients).filter(key => clients[key] !== null),
    });
  }

  /**
   * Execute an AI operation with automatic routing and fallback
   * 
   * @param operation - Operation name from ModelConfig
   * @param params - Request parameters
   * @param params.systemPrompt - System prompt for the LLM
   * @param params.userMessage - User message (optional)
   * @param params.messages - Full message array (alternative to systemPrompt)
   * @param params.temperature - Override config temperature
   * @param params.maxTokens - Override config maxTokens
   * @param params.timeout - Override config timeout
   * @param params.jsonMode - Override config JSON mode
   * @param params.responseFormat - PDF Design C: Structured outputs schema
   * @param params.signal - Abort signal for cancellation
   * @param params.priority - Priority flag for queue management
   * @returns LLM response in normalized format
   * 
   * @example
   * const response = await aiService.execute('optimize_standard', {
   *   systemPrompt: 'You are a helpful assistant',
   *   userMessage: 'Optimize this prompt...',
   *   temperature: 0.8
   * });
   * 
   * @example PDF Design C: Grammar-constrained decoding
   * const response = await aiService.execute('span_labeling', {
   *   systemPrompt: '...',
   *   userMessage: '...',
   *   responseFormat: { type: 'json_schema', json_schema: {...} }
   * });
   */
  async execute(operation: string, params: ExecuteParams): Promise<AIResponse> {
    if (!params.systemPrompt) {
      throw new Error('systemPrompt is required');
    }

    const config = this._getConfig(operation);
    const client = this._getClient(config);

    // Merge operation config with request params (params override config)
    const requestOptions: RequestOptions = {
      ...params,
      model: (params.model as string | undefined) || config.model,
      temperature: params.temperature !== undefined ? params.temperature : config.temperature,
      maxTokens: params.maxTokens || config.maxTokens,
      timeout: params.timeout || config.timeout,
      // PDF Design C: Support structured outputs (response_format with json_schema)
      // If params.responseFormat is provided, use it; otherwise fall back to config
      jsonMode: params.responseFormat ? false : (config.responseFormat === 'json_object' || params.jsonMode || false),
      responseFormat: params.responseFormat || (config.responseFormat === 'json_object' ? { type: 'json_object' } : undefined),
    };

    try {
      logger.debug('Executing AI operation', {
        operation,
        client: config.client,
        model: requestOptions.model,
        jsonMode: requestOptions.jsonMode,
      });

      // Execute the request through the selected client
      const response = await client.complete(params.systemPrompt, requestOptions);

      logger.debug('AI operation completed', {
        operation,
        client: config.client,
        success: true,
      });

      return response;

    } catch (error: unknown) {
      const err = error as { message: string; statusCode?: number; isRetryable?: boolean };
      
      logger.warn('AI operation failed on primary client', {
        operation,
        client: config.client,
        error: err.message,
        statusCode: err.statusCode,
      });

      // INTELLIGENT FALLBACK: Only retry if error is retryable
      // Don't fallback on 400 (Bad Request) as the same invalid request will fail again
      const shouldFallback = config.fallbackTo && 
                            this.clients[config.fallbackTo] && 
                            (err.isRetryable !== false); // Default to true if undefined

      if (shouldFallback && config.fallbackTo) {
        logger.info('Error is retryable, attempting fallback', {
          operation,
          fallbackTo: config.fallbackTo,
        });
        return await this._executeFallback(config.fallbackTo, operation, params.systemPrompt, requestOptions);
      }

      // No fallback available or error is not retryable
      logger.error('AI operation failed with no fallback', error instanceof Error ? error : undefined, {
        operation,
        client: config.client,
        error: err.message,
        isRetryable: err.isRetryable,
      });
      throw error;
    }
  }

  /**
   * Execute an AI operation with streaming for real-time UI updates
   * 
   * @param operation - Operation name from ModelConfig
   * @param params - Request parameters
   * @param params.systemPrompt - System prompt for the LLM
   * @param params.userMessage - User message
   * @param params.messages - Full message array (alternative to systemPrompt)
   * @param params.onChunk - Callback for each streamed chunk
   * @param params.temperature - Override config temperature
   * @param params.maxTokens - Override config maxTokens
   * @param params.timeout - Override config timeout
   * @param params.jsonMode - Override config JSON mode
   * @param params.signal - Abort signal for cancellation
   * @param params.priority - Priority flag for queue management
   * @returns Complete generated text
   * 
   * @example
   * const text = await aiService.stream('optimize_draft', {
   *   systemPrompt: 'Generate a draft...',
   *   userMessage: 'Create a video prompt',
   *   onChunk: (chunk) => console.log(chunk)
   * });
   */
  async stream(operation: string, params: StreamParams): Promise<string> {
    const config = this._getConfig(operation);
    const client = this._getClient(config);

    // Verify client supports streaming
    if (typeof (client as { streamComplete?: (systemPrompt: string, options: unknown) => Promise<string> }).streamComplete !== 'function') {
      throw new Error(
        `Client '${config.client}' does not support streaming. ` +
        `Use execute() instead or configure a streaming-capable client.`
      );
    }

    // Verify onChunk callback is provided
    if (!params.onChunk || typeof params.onChunk !== 'function') {
      throw new Error('Streaming requires onChunk callback function');
    }

    // Merge operation config with request params
    const streamOptions: StreamParams = {
      ...params,
      model: params.model || config.model,
      temperature: params.temperature !== undefined ? params.temperature : config.temperature,
      maxTokens: params.maxTokens || config.maxTokens,
      timeout: params.timeout || config.timeout,
      // Pass jsonMode from config
      jsonMode: config.responseFormat === 'json_object' || params.jsonMode || false,
      onChunk: params.onChunk,
    };

    try {
      logger.debug('Streaming AI operation', {
        operation,
        client: config.client,
        model: streamOptions.model,
        jsonMode: streamOptions.jsonMode,
      });

      const streamClient = client as unknown as { streamComplete: (systemPrompt: string, options: StreamParams) => Promise<string> };
      const text = await streamClient.streamComplete(params.systemPrompt as string, streamOptions);

      logger.debug('AI streaming completed', {
        operation,
        client: config.client,
        textLength: text.length,
      });

      return text;

    } catch (error: unknown) {
      const err = error as { message: string };
      
      logger.error('AI streaming failed', error instanceof Error ? error : undefined, {
        operation,
        client: config.client,
        error: err.message,
      });

      // Note: Fallback for streaming is complex due to the callback pattern
      // For now, we fail fast. Future enhancement could buffer and replay.
      throw error;
    }
  }

  /**
   * Execute fallback request on alternative client
   * @private
   */
  private async _executeFallback(
    fallbackClient: string,
    operation: string,
    systemPrompt: string,
    requestOptions: RequestOptions
  ): Promise<AIResponse> {
    logger.info('Attempting fallback to alternative client', {
      operation,
      fallbackClient,
    });

    try {
      const client = this.clients[fallbackClient];
      
      if (!client) {
        throw new Error(`Fallback client '${fallbackClient}' not available`);
      }
      
      // IMPORTANT: Don't pass the primary client's model to the fallback client
      // Each client has its own default model configured in services.config.js
      // Remove the model from requestOptions to let the fallback use its default
      const fallbackOptions: CompletionOptions = {
        ...requestOptions,
        model: undefined, // Let fallback client use its own default model
      };
      
      // Remove model to use fallback client's default
      delete fallbackOptions.model;
      
      const response = await client.complete(systemPrompt, fallbackOptions);

      logger.info('Fallback succeeded', {
        operation,
        fallbackClient,
      });

      return response;

    } catch (fallbackError: unknown) {
      const err = fallbackError as { message: string };
      
      logger.error('Fallback also failed', fallbackError instanceof Error ? fallbackError : undefined, {
        operation,
        fallbackClient,
        error: err.message,
      });
      throw fallbackError;
    }
  }

  /**
   * Get configuration for an operation
   * @private
   */
  private _getConfig(operation: string): ModelConfigEntry {
    const config = ModelConfig[operation] as ModelConfigEntry | undefined;
    
    if (!config) {
      logger.warn('Operation not found in config, using default', {
        operation,
        availableOperations: Object.keys(ModelConfig).slice(0, 5), // Sample
      } as Record<string, unknown>);
      return DEFAULT_CONFIG as ModelConfigEntry;
    }

    return config;
  }

  /**
   * Get client for a configuration
   * @private
   */
  private _getClient(config: ModelConfigEntry): IAIClient {
    const client = this.clients[config.client];

    if (!client) {
      // If configured client is missing, try default
      const defaultClient = this.clients[DEFAULT_CONFIG.client];
      
      if (defaultClient) {
        logger.warn('Configured client not available, using default', {
          requested: config.client,
          using: DEFAULT_CONFIG.client,
        });
        return defaultClient;
      }

      // No client available at all
      throw new Error(
        `No API client available for configuration '${config.client}'. ` +
        `Available clients: ${Object.keys(this.clients).filter(k => this.clients[k]).join(', ')}`
      );
    }

    return client;
  }

  /**
   * Get list of available operations
   * @returns Array of operation names
   */
  listOperations(): string[] {
    return Object.keys(ModelConfig);
  }

  /**
   * Get configuration for an operation (for inspection/debugging)
   * @param operation - Operation name
   * @returns Configuration object
   */
  getOperationConfig(operation: string): ModelConfigEntry {
    return this._getConfig(operation);
  }

  /**
   * Check if an operation is configured
   * @param operation - Operation name
   * @returns True if operation exists in config
   */
  hasOperation(operation: string): boolean {
    return operation in ModelConfig;
  }

  /**
   * Get list of available clients
   * @returns Array of client names
   */
  getAvailableClients(): string[] {
    return Object.keys(this.clients).filter(key => this.clients[key] !== null);
  }

  /**
   * Check if streaming is available for an operation
   * @param operation - Operation name
   * @returns True if streaming is supported
   */
  supportsStreaming(operation: string): boolean {
    const config = this._getConfig(operation);
    const client = this._getClient(config);
    return typeof (client as { streamComplete?: (systemPrompt: string, options: unknown) => Promise<string> }).streamComplete === 'function';
  }
}
