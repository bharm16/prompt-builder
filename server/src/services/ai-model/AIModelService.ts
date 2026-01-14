import { logger } from '@infrastructure/Logger';
import { ModelConfig, shouldUseSeed } from '@config/modelConfig';
import { hashString } from '@utils/hash';
import { detectAndGetCapabilities } from '@utils/provider/ProviderDetector';
import { AIClientError, type IAIClient, type AIResponse, type CompletionOptions } from '@interfaces/IAIClient';
import { buildRequestOptions } from './request/RequestOptionsBuilder';
import { buildResponseFormat } from './request/ResponseFormatBuilder';
import { ClientResolver } from './routing/ClientResolver';
import { ExecutionPlanResolver } from './routing/ExecutionPlan';
import type { ClientsMap, ExecuteParams, ModelConfigEntry, RequestOptions, StreamParams } from './types';

export type { ExecuteParams, StreamParams } from './types';

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
 * Provider-Aware Optimizations:
 * - OpenAI: developerMessage for hard constraints, seed for reproducibility
 * - Groq: Sandwich prompting, temperature 0.1 for JSON
 * - Automatic capability detection and optimization
 *
 * Key Features:
 * - Operation-based routing (not client-based)
 * - Automatic fallback support
 * - Streaming support for real-time UI
 * - Environment variable overrides
 * - Circuit breaker awareness
 */
export class AIModelService {
  private readonly clientResolver: ClientResolver;
  private readonly planResolver: ExecutionPlanResolver;
  private readonly hasAnyClient: boolean;

  constructor({ clients }: { clients: ClientsMap }) {
    if (!clients || typeof clients !== 'object') {
      throw new Error('AIModelService requires clients object');
    }

    this.clientResolver = new ClientResolver(clients);
    this.planResolver = new ExecutionPlanResolver(this.clientResolver);
    this.hasAnyClient = this.clientResolver.hasAnyClient();

    const availableClients = this.clientResolver.getAvailableClients();

    if (!this.hasAnyClient) {
      logger.error('No AI clients configured; AI operations will be unavailable until a provider is enabled');
    }

    if (!this.clientResolver.hasClient('openai')) {
      logger.warn('OpenAI client not configured; operations targeting OpenAI will require fallbacks');
    }

    logger.info('AIModelService initialized', {
      availableClients,
    });
  }

  /**
   * Execute an AI operation with automatic routing and fallback
   *
   * Provider-Aware Optimizations:
   * - OpenAI: developerMessage for hard constraints, seed for reproducibility
   * - Groq: Sandwich prompting handled by adapter
   *
   * @param operation - Operation name from ModelConfig
   * @param params - Request parameters
   */
  async execute(operation: string, params: ExecuteParams): Promise<AIResponse> {
    if (!params.systemPrompt) {
      throw new Error('systemPrompt is required');
    }

    if (!this.hasAnyClient) {
      throw new AIClientError('No AI providers configured; enable at least one LLM provider', 503);
    }

    const plan = this.planResolver.resolve(operation);
    const config = plan.primaryConfig;

    // Try to get the primary client, falling back if unavailable
    let client: IAIClient;
    try {
      client = this.clientResolver.getClient(config);
    } catch (clientError) {
      // Primary client unavailable - try fallback immediately
      if (plan.fallback && this.clientResolver.hasClient(plan.fallback.client)) {
        logger.warn('Primary client unavailable, using fallback', {
          operation,
          primary: config.client,
          fallback: plan.fallback.client,
        });

        // Build minimal request options for fallback
        const fallbackOptions: RequestOptions = {
          ...params,
          model: plan.fallback.model,
          temperature: params.temperature !== undefined ? params.temperature : config.temperature,
          maxTokens: params.maxTokens || config.maxTokens,
          timeout: plan.fallback.timeout,
          jsonMode: config.responseFormat === 'json_object' || params.jsonMode || false,
        };

        return await this._executeFallback(
          plan.fallback.client,
          operation,
          params.systemPrompt,
          fallbackOptions,
          { model: plan.fallback.model, timeout: plan.fallback.timeout }
        );
      }

      // No fallback available, re-throw
      throw clientError;
    }

    // Detect provider capabilities
    const { provider, capabilities } = detectAndGetCapabilities({
      operation,
      model: config.model,
      client: config.client,
    });

    const { responseFormat, jsonMode } = buildResponseFormat(params, config, capabilities);

    // Build request options with provider-specific optimizations
    const requestOptions = buildRequestOptions({
      operation,
      params,
      config,
      capabilities,
      jsonMode,
      ...(responseFormat ? { responseFormat } : {}),
    });

    try {
      logger.debug('Executing AI operation', {
        operation,
        client: config.client,
        model: requestOptions.model,
        provider,
        jsonMode: requestOptions.jsonMode,
        hasDeveloperMessage: !!requestOptions.developerMessage,
        hasSeed: requestOptions.seed !== undefined,
      });

      const response = await client.complete(params.systemPrompt, requestOptions);

      logger.debug('AI operation completed', {
        operation,
        client: config.client,
        success: true,
      });

      return response;

    } catch (error: unknown) {
      const err = error as { message: string; statusCode?: number; isRetryable?: boolean };

      // Some providers/models reject `logprobs`; retry once without it.
      const hasLogprobs = requestOptions.logprobs === true;
      const logprobsUnsupported =
        typeof err.message === 'string' &&
        err.message.toLowerCase().includes('logprobs') &&
        err.message.toLowerCase().includes('not supported');

      if (hasLogprobs && logprobsUnsupported) {
        logger.warn('Retrying AI operation without logprobs', {
          operation,
          client: config.client,
          model: requestOptions.model,
        });

        const retryOptions: RequestOptions = { ...requestOptions };
        delete (retryOptions as Record<string, unknown>).logprobs;
        delete (retryOptions as Record<string, unknown>).topLogprobs;

        try {
          const response = await client.complete(params.systemPrompt, retryOptions);
          logger.info('AI operation succeeded after disabling logprobs', {
            operation,
            client: config.client,
            model: retryOptions.model,
          });
          return response;
        } catch (retryError) {
          // Fall through to normal fallback handling using the original error.
          logger.warn('Retry without logprobs failed', {
            operation,
            client: config.client,
            error: (retryError as Error).message,
          });
        }
      }

      logger.warn('AI operation failed on primary client', {
        operation,
        client: config.client,
        error: err.message,
        statusCode: err.statusCode,
      });

      // Intelligent fallback
      const shouldFallback = plan.fallback &&
                            this.clientResolver.hasClient(plan.fallback.client) &&
                            (err.isRetryable !== false);

      if (shouldFallback && plan.fallback) {
        logger.info('Error is retryable, attempting fallback', {
          operation,
          fallbackTo: plan.fallback.client,
        });
        return await this._executeFallback(
          plan.fallback.client,
          operation,
          params.systemPrompt,
          requestOptions,
          { model: plan.fallback.model, timeout: plan.fallback.timeout }
        );
      }

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
   * Execute an AI operation with streaming
   */
  async stream(operation: string, params: StreamParams): Promise<string> {
    if (!this.hasAnyClient) {
      throw new AIClientError('No AI providers configured; enable at least one LLM provider', 503);
    }

    const plan = this.planResolver.resolve(operation);
    const config = plan.primaryConfig;
    const client = this.clientResolver.getClient(config);

    if (typeof (client as { streamComplete?: (systemPrompt: string, options: unknown) => Promise<string> }).streamComplete !== 'function') {
      throw new Error(
        `Client '${config.client}' does not support streaming. ` +
        `Use execute() instead or configure a streaming-capable client.`
      );
    }

    if (!params.onChunk || typeof params.onChunk !== 'function') {
      throw new Error('Streaming requires onChunk callback function');
    }

    const streamOptions: StreamParams = {
      ...params,
      model: params.model || config.model,
      temperature: params.temperature !== undefined ? params.temperature : config.temperature,
      maxTokens: params.maxTokens || config.maxTokens,
      timeout: params.timeout || config.timeout,
      jsonMode: config.responseFormat === 'json_object' || params.jsonMode || false,
      onChunk: params.onChunk,
    };

    // Add seed for reproducibility if configured
    if (shouldUseSeed(operation)) {
      streamOptions.seed = hashString(String(params.systemPrompt)) % 2147483647;
    }

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

      throw error;
    }
  }

  /**
   * Execute fallback request on alternative client
   *
   * Uses fallbackConfig from ModelConfig when available to set the correct
   * model and timeout for the fallback provider.
   *
   * @private
   */
  private async _executeFallback(
    fallbackClient: string,
    operation: string,
    systemPrompt: string,
    requestOptions: RequestOptions,
    fallbackConfig?: { model: string; timeout: number }
  ): Promise<AIResponse> {
    logger.info('Attempting fallback to alternative client', {
      operation,
      fallbackClient,
      fallbackModel: fallbackConfig?.model,
    });

    try {
      const client = this.clientResolver.getClientByName(fallbackClient);

      if (!client) {
        throw new Error(`Fallback client '${fallbackClient}' not available`);
      }

      if (fallbackClient === 'qwen') {
        const circuitState = (client as { getCircuitBreakerState?: () => 'OPEN' | 'HALF-OPEN' | 'CLOSED' })
          .getCircuitBreakerState?.();
        if (circuitState === 'OPEN') {
          logger.warn('Skipping fallback due to open circuit breaker', {
            operation,
            fallbackClient,
            fallbackModel: fallbackConfig?.model,
          });
          throw new AIClientError(`${fallbackClient} API circuit breaker is open`, 503);
        }
      }

      // Build fallback options with fallbackConfig when available
      // This ensures we use the correct model for the fallback provider
      const fallbackOptions: CompletionOptions = {
        ...requestOptions,
        // Use fallbackConfig.timeout if provided
        timeout: fallbackConfig?.timeout || requestOptions.timeout,
        ...(fallbackConfig?.model ? { model: fallbackConfig.model } : {}),
      };

      delete (fallbackOptions as { developerMessage?: string }).developerMessage;

      const response = await client.complete(systemPrompt, fallbackOptions);

      logger.info('Fallback succeeded', {
        operation,
        fallbackClient,
        model: fallbackConfig?.model || 'client-default',
      });

      return response;

    } catch (fallbackError: unknown) {
      const err = fallbackError as { message: string };

      logger.error('Fallback also failed', fallbackError instanceof Error ? fallbackError : undefined, {
        operation,
        fallbackClient,
        fallbackModel: fallbackConfig?.model,
        error: err.message,
      });
      throw fallbackError;
    }
  }

  listOperations(): string[] {
    return Object.keys(ModelConfig);
  }

  getOperationConfig(operation: string): ModelConfigEntry {
    return this.planResolver.getConfig(operation);
  }

  hasOperation(operation: string): boolean {
    return operation in ModelConfig;
  }

  getAvailableClients(): string[] {
    return this.clientResolver.getAvailableClients();
  }

  supportsStreaming(operation: string): boolean {
    if (!this.hasAnyClient) {
      return false;
    }
    const plan = this.planResolver.resolve(operation);
    const client = this.clientResolver.getClient(plan.primaryConfig);
    return typeof (client as { streamComplete?: (systemPrompt: string, options: unknown) => Promise<string> }).streamComplete === 'function';
  }
}
