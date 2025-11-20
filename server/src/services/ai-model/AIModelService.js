import { logger } from '../../infrastructure/Logger.js';
import { ModelConfig, DEFAULT_CONFIG } from '../../config/modelConfig.js';

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
export class AIModelService {
  /**
   * Create AI Model Service
   * @param {Object} params - Constructor parameters
   * @param {Object} params.clients - Map of available clients
   * @param {Object} params.clients.openai - OpenAI API client
   * @param {Object} params.clients.groq - Groq API client (optional)
   */
  constructor({ clients }) {
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
   * @param {string} operation - Operation name from ModelConfig
   * @param {Object} params - Request parameters
   * @param {string} params.systemPrompt - System prompt for the LLM
   * @param {string} [params.userMessage] - User message (optional)
   * @param {Array} [params.messages] - Full message array (alternative to systemPrompt)
   * @param {number} [params.temperature] - Override config temperature
   * @param {number} [params.maxTokens] - Override config maxTokens
   * @param {number} [params.timeout] - Override config timeout
   * @param {AbortSignal} [params.signal] - Abort signal for cancellation
   * @param {boolean} [params.priority] - Priority flag for queue management
   * @returns {Promise<Object>} LLM response in normalized format
   * 
   * @example
   * const response = await aiService.execute('optimize_standard', {
   *   systemPrompt: 'You are a helpful assistant',
   *   userMessage: 'Optimize this prompt...',
   *   temperature: 0.8
   * });
   */
  async execute(operation, params = {}) {
    const config = this._getConfig(operation);
    const client = this._getClient(config);

    // Merge operation config with request params (params override config)
    const requestOptions = {
      ...params,
      model: params.model || config.model,
      temperature: params.temperature !== undefined ? params.temperature : config.temperature,
      maxTokens: params.maxTokens || config.maxTokens,
      timeout: params.timeout || config.timeout,
    };

    try {
      logger.debug('Executing AI operation', {
        operation,
        client: config.client,
        model: requestOptions.model,
      });

      // Execute the request through the selected client
      const response = await client.complete(params.systemPrompt, requestOptions);

      logger.debug('AI operation completed', {
        operation,
        client: config.client,
        success: true,
      });

      return response;

    } catch (error) {
      logger.warn('AI operation failed on primary client', {
        operation,
        client: config.client,
        error: error.message,
      });

      // Attempt fallback if configured
      if (config.fallbackTo && this.clients[config.fallbackTo]) {
        return await this._executeFallback(config.fallbackTo, operation, params.systemPrompt, requestOptions);
      }

      // No fallback available, propagate error
      logger.error('AI operation failed with no fallback', {
        operation,
        client: config.client,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Execute an AI operation with streaming for real-time UI updates
   * 
   * @param {string} operation - Operation name from ModelConfig
   * @param {Object} params - Request parameters
   * @param {string} params.systemPrompt - System prompt for the LLM
   * @param {string} [params.userMessage] - User message
   * @param {Function} params.onChunk - Callback for each streamed chunk
   * @param {number} [params.temperature] - Override config temperature
   * @param {number} [params.maxTokens] - Override config maxTokens
   * @param {number} [params.timeout] - Override config timeout
   * @returns {Promise<string>} Complete generated text
   * 
   * @example
   * const text = await aiService.stream('optimize_draft', {
   *   systemPrompt: 'Generate a draft...',
   *   userMessage: 'Create a video prompt',
   *   onChunk: (chunk) => console.log(chunk)
   * });
   */
  async stream(operation, params = {}) {
    const config = this._getConfig(operation);
    const client = this._getClient(config);

    // Verify client supports streaming
    if (typeof client.streamComplete !== 'function') {
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
    const requestOptions = {
      ...params,
      model: params.model || config.model,
      temperature: params.temperature !== undefined ? params.temperature : config.temperature,
      maxTokens: params.maxTokens || config.maxTokens,
      timeout: params.timeout || config.timeout,
    };

    try {
      logger.debug('Streaming AI operation', {
        operation,
        client: config.client,
        model: requestOptions.model,
      });

      const text = await client.streamComplete(params.systemPrompt, requestOptions);

      logger.debug('AI streaming completed', {
        operation,
        client: config.client,
        textLength: text.length,
      });

      return text;

    } catch (error) {
      logger.error('AI streaming failed', {
        operation,
        client: config.client,
        error: error.message,
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
  async _executeFallback(fallbackClient, operation, systemPrompt, requestOptions) {
    logger.info('Attempting fallback to alternative client', {
      operation,
      fallbackClient,
    });

    try {
      const client = this.clients[fallbackClient];
      
      // IMPORTANT: Don't pass the primary client's model to the fallback client
      // Each client has its own default model configured in services.config.js
      // Remove the model from requestOptions to let the fallback use its default
      const fallbackOptions = {
        ...requestOptions,
        model: undefined, // Let fallback client use its own default model
      };
      
      const response = await client.complete(systemPrompt, fallbackOptions);

      logger.info('Fallback succeeded', {
        operation,
        fallbackClient,
      });

      return response;

    } catch (fallbackError) {
      logger.error('Fallback also failed', {
        operation,
        fallbackClient,
        error: fallbackError.message,
      });
      throw fallbackError;
    }
  }

  /**
   * Get configuration for an operation
   * @private
   */
  _getConfig(operation) {
    const config = ModelConfig[operation];
    
    if (!config) {
      logger.warn('Operation not found in config, using default', {
        operation,
        availableOperations: Object.keys(ModelConfig).slice(0, 5), // Sample
      });
      return DEFAULT_CONFIG;
    }

    return config;
  }

  /**
   * Get client for a configuration
   * @private
   */
  _getClient(config) {
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
   * @returns {string[]} Array of operation names
   */
  listOperations() {
    return Object.keys(ModelConfig);
  }

  /**
   * Get configuration for an operation (for inspection/debugging)
   * @param {string} operation - Operation name
   * @returns {Object} Configuration object
   */
  getOperationConfig(operation) {
    return this._getConfig(operation);
  }

  /**
   * Check if an operation is configured
   * @param {string} operation - Operation name
   * @returns {boolean} True if operation exists in config
   */
  hasOperation(operation) {
    return operation in ModelConfig;
  }

  /**
   * Get list of available clients
   * @returns {string[]} Array of client names
   */
  getAvailableClients() {
    return Object.keys(this.clients).filter(key => this.clients[key] !== null);
  }

  /**
   * Check if streaming is available for an operation
   * @param {string} operation - Operation name
   * @returns {boolean} True if streaming is supported
   */
  supportsStreaming(operation) {
    const config = this._getConfig(operation);
    const client = this._getClient(config);
    return typeof client.streamComplete === 'function';
  }
}

