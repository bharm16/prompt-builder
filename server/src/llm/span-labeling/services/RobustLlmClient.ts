import { SubstringPositionCache } from '../cache/SubstringPositionCache.js';
import SpanLabelingConfig from '../config/SpanLabelingConfig.js';
import { sanitizePolicy, sanitizeOptions, buildTaskDescription } from '../utils/policyUtils.js';
import { parseJson, buildUserPayload } from '../utils/jsonUtils.js';
import { formatValidationErrors } from '../utils/textUtils.js';
import { validateSchemaOrThrow } from '../validation/SchemaValidator.js';
import { validateSpans } from '../validation/SpanValidator.js';
import { buildSystemPrompt, BASE_SYSTEM_PROMPT, buildSpanLabelingMessages, getFewShotExamples } from '../utils/promptBuilder.js';
import { detectAndGetCapabilities } from '@utils/provider/ProviderDetector.js';
import { getSpanLabelingSchema } from '@utils/provider/SchemaFactory.js';
import { logger } from '@infrastructure/Logger';
import type { LabelSpansResult, ValidationPolicy, ProcessingOptions, LLMSpan } from '../types.js';
import type { AIService as BaseAIService } from '../../../types.js';
import type { LlmSpanParams, ILlmClient } from './ILlmClient.js';

/**
 * Response from callModel with full metadata
 */
export interface ModelResponse {
  text: string;
  metadata?: {
    averageConfidence?: number;
    logprobs?: unknown[];
    provider?: string;
    optimizations?: string[];
    [key: string]: unknown;
  };
}

/**
 * Provider-specific request options
 * Subclasses configure these via hooks
 */
export interface ProviderRequestOptions {
  enableBookending: boolean;
  useFewShot: boolean;
  useSeedFromConfig: boolean;
  enableLogprobs: boolean;
  developerMessage?: string;
  providerName?: string;
}

/**
 * Call LLM with system prompt and user payload using AIModelService
 * 
 * This is a shared utility - provider-specific options are passed in.
 */
async function callModel({
  systemPrompt,
  userPayload,
  aiService,
  maxTokens,
  providerOptions,
  schema,
}: {
  systemPrompt: string;
  userPayload: string;
  aiService: BaseAIService;
  maxTokens: number;
  providerOptions: ProviderRequestOptions;
  schema?: Record<string, unknown>;
}): Promise<ModelResponse> {
  const requestOptions: Record<string, unknown> = {
    systemPrompt,
    userMessage: userPayload,
    maxTokens,
    jsonMode: !schema,
    enableBookending: providerOptions.enableBookending,
    useSeedFromConfig: providerOptions.useSeedFromConfig,
    logprobs: providerOptions.enableLogprobs,
  };

  if (providerOptions.developerMessage) {
    requestOptions.developerMessage = providerOptions.developerMessage;
  }

  if (schema) {
    requestOptions.schema = schema;
  }

  // Few-shot examples as message array (Llama 3 best practice)
  if (providerOptions.useFewShot) {
    const fewShotExamples = getFewShotExamples(providerOptions.providerName || 'groq');
    const payloadObj = JSON.parse(userPayload);
    
    requestOptions.messages = [
      { role: 'system', content: systemPrompt },
      ...fewShotExamples,
      { role: 'user', content: payloadObj.text }
    ];
    requestOptions.enableSandwich = true;
  }

  const response = await aiService.execute('span_labeling', requestOptions);

  let text = '';
  if (response.text) {
    text = response.text;
  } else if (response.content && Array.isArray(response.content) && response.content.length > 0) {
    text = response.content[0]?.text || '';
  }

  return {
    text,
    metadata: response.metadata || {},
  };
}

/**
 * Base LLM Client - Provider Agnostic
 *
 * Encapsulates the "try, validate, repair" cycle for LLM-based span labeling.
 * 
 * DESIGN: This base class contains NO provider-specific logic.
 * Subclasses (GroqLlmClient, OpenAILlmClient) override hooks to customize behavior.
 * 
 * Hook methods that subclasses should override:
 * - _getProviderRequestOptions(): Configure provider-specific request options
 * - _postProcessResult(): Apply provider-specific post-processing
 * - _getProviderName(): Return provider identifier for logging
 */
export class RobustLlmClient implements ILlmClient {
  /**
   * Last response metadata - available for subclass post-processing
   */
  protected _lastResponseMetadata: ModelResponse['metadata'] = {};

  /**
   * Get spans using LLM with validation and optional repair
   */
  async getSpans(params: LlmSpanParams): Promise<LabelSpansResult> {
    const { text, policy, options, enableRepair, aiService, cache, nlpSpansAttempted } = params;

    const estimatedMaxTokens = SpanLabelingConfig.estimateMaxTokens(
      options.maxSpans || SpanLabelingConfig.DEFAULT_OPTIONS.maxSpans
    );

    const task = buildTaskDescription(options.maxSpans || SpanLabelingConfig.DEFAULT_OPTIONS.maxSpans, policy);

    const basePayload = {
      task,
      policy,
      text,
      templateVersion: options.templateVersion || SpanLabelingConfig.DEFAULT_OPTIONS.templateVersion,
    };

    // Get provider-specific options from subclass (merge providerName for few-shot lookup)
    const providerName = this._getProviderName();
    const modelConfig = this._getModelConfig(aiService, 'span_labeling');
    const { provider, capabilities } = detectAndGetCapabilities({
      operation: 'span_labeling',
      model: modelConfig?.model,
      client: process.env.SPAN_PROVIDER || providerName,
    });
    const supportsSchema = capabilities.strictJsonSchema || provider === 'groq' || provider === 'qwen';
    const spanSchema = supportsSchema
      ? getSpanLabelingSchema({ operation: 'span_labeling', model: modelConfig?.model, provider })
      : undefined;
    const providerOptions: ProviderRequestOptions = {
      ...this._getProviderRequestOptions(),
      providerName,
    };

    // Build system prompt
    const contextAwareSystemPrompt = buildSystemPrompt(text, true, providerName, Boolean(spanSchema));

    // Check for two-pass architecture (GPT-4o-mini with complex schemas)
    const isMini = modelConfig?.model?.includes('mini') || 
                   modelConfig?.model?.includes('gpt-4o-mini') ||
                   process.env.SPAN_MODEL?.includes('mini');
    const hasComplexSchema = this._isComplexSchemaForSpans();

    let primaryResponse: ModelResponse;

    if (isMini && hasComplexSchema) {
      // Two-Pass Architecture for mini models
      primaryResponse = await this._twoPassExtraction({
        systemPrompt: contextAwareSystemPrompt,
        userPayload: buildUserPayload(basePayload),
        aiService,
        maxTokens: estimatedMaxTokens,
        providerOptions,
        schema: spanSchema,
      });
    } else {
      // Standard single-pass extraction
      primaryResponse = await callModel({
        systemPrompt: contextAwareSystemPrompt,
        userPayload: buildUserPayload(basePayload),
        aiService,
        maxTokens: estimatedMaxTokens,
        providerOptions,
        schema: spanSchema,
      });
    }

    // Store metadata for subclass access
    this._lastResponseMetadata = primaryResponse.metadata;

    const parsedPrimary = parseJson(primaryResponse.text);
    if (!parsedPrimary.ok) {
      throw new Error(parsedPrimary.error);
    }

    // Inject default meta if LLM omitted it
    this._injectDefensiveMeta(parsedPrimary.value, options, nlpSpansAttempted);

    // Validate schema
    validateSchemaOrThrow(parsedPrimary.value, spanSchema);

    const isAdversarial =
      parsedPrimary.value?.isAdversarial === true ||
      parsedPrimary.value?.is_adversarial === true;

    if (isAdversarial) {
      const validation = validateSpans({
        spans: [],
        meta: parsedPrimary.value.meta,
        text,
        policy,
        options,
        attempt: 1,
        cache,
        isAdversarial: true,
        analysisTrace: parsedPrimary.value.analysis_trace || null,
      });

      return this._postProcessResult(validation.result);
    }

    // Validate spans (strict mode)
    let validation = validateSpans({
      spans: parsedPrimary.value.spans || [],
      meta: parsedPrimary.value.meta,
      text,
      policy,
      options,
      attempt: 1,
      cache,
      isAdversarial,
      analysisTrace: parsedPrimary.value.analysis_trace || null,
    });

    if (validation.ok) {
      return this._postProcessResult(validation.result);
    }

    // Handle validation failure
    if (!enableRepair) {
      validation = validateSpans({
        spans: parsedPrimary.value.spans || [],
        meta: parsedPrimary.value.meta,
        text,
        policy,
        options,
        attempt: 2,
        cache,
        isAdversarial,
        analysisTrace: parsedPrimary.value.analysis_trace || null,
      });

      return this._postProcessResult(validation.result);
    }

    // Repair attempt
    const repairResult = await this._attemptRepair({
      basePayload,
      validationErrors: validation.errors,
      originalResponse: parsedPrimary.value,
      text,
      policy,
      options,
      aiService,
      cache,
      estimatedMaxTokens,
      providerOptions,
      schema: spanSchema,
    });

    return this._postProcessResult(repairResult);
  }

  // ============================================================
  // HOOKS - Override in subclasses for provider-specific behavior
  // ============================================================

  /**
   * HOOK: Get provider-specific request options
   * 
   * Override in subclasses to configure:
   * - enableBookending: Repeat instructions at end (OpenAI)
   * - useFewShot: Include few-shot examples (Groq)
   * - useSeedFromConfig: Enable deterministic output
   * - enableLogprobs: Request token probabilities (Groq)
   * - developerMessage: Hard constraints (OpenAI)
   */
  protected _getProviderRequestOptions(): ProviderRequestOptions {
    // Default: Conservative options that work for any provider
    return {
      enableBookending: false,
      useFewShot: false,
      useSeedFromConfig: true,
      enableLogprobs: false,
    };
  }

  /**
   * HOOK: Get provider name for logging and prompt building
   */
  protected _getProviderName(): string {
    return 'unknown';
  }

  /**
   * HOOK: Post-process result with provider-specific adjustments
   * 
   * Override in subclasses for:
   * - Groq: Logprobs-based confidence adjustment
   * - OpenAI: No adjustments needed (strict schema handles it)
   */
  protected _postProcessResult(result: LabelSpansResult): LabelSpansResult {
    // Default: No post-processing
    return result;
  }

  // ============================================================
  // SHARED IMPLEMENTATION (Not meant to be overridden)
  // ============================================================

  /**
   * Two-Pass Architecture for GPT-4o-mini with complex schemas
   */
  private async _twoPassExtraction({
    systemPrompt,
    userPayload,
    aiService,
    maxTokens,
    providerOptions,
    schema,
  }: {
    systemPrompt: string;
    userPayload: string;
    aiService: BaseAIService;
    maxTokens: number;
    providerOptions: ProviderRequestOptions;
    schema?: Record<string, unknown>;
  }): Promise<ModelResponse> {
    const payloadData = JSON.parse(userPayload);
    const providerName = this._getProviderName();

    const { provider, capabilities } = detectAndGetCapabilities({
      operation: 'span_labeling',
      model: this._getModelConfig(aiService, 'span_labeling')?.model,
      client: process.env.SPAN_PROVIDER,
    });

    logger.info('Using two-pass extraction for complex schema', {
      provider: providerName,
      hasDeveloperRole: capabilities.developerRole,
    });

    // Pass 1: Free-text reasoning
    const reasoningPrompt = `${systemPrompt}

## Two-Pass Analysis Mode - Pass 1: REASONING

Analyze the input text and identify ALL key entities, relationships, and span boundaries.
Think step-by-step about what should be labeled.
Output your analysis in free text / markdown format.
Do NOT worry about JSON structure yet - just reason through the task.`;

    const reasoningResponse = await callModel({
      systemPrompt: reasoningPrompt,
      userPayload: JSON.stringify({
        task: 'Analyze the text and provide step-by-step reasoning about what spans should be labeled.',
        policy: payloadData.policy,
        text: payloadData.text,
        templateVersion: payloadData.templateVersion,
      }),
      aiService,
      maxTokens: Math.floor(maxTokens * 0.6),
      providerOptions: {
        ...providerOptions,
        enableBookending: false, // No bookending for reasoning pass
      },
    });

    logger.debug('Pass 1 (reasoning) completed', {
      responseLength: reasoningResponse.text.length,
      provider: providerName,
    });

    // Pass 2: Structure the reasoning
    const structuringPrompt = capabilities.developerRole
      ? systemPrompt
      : `${systemPrompt}

## Two-Pass Analysis Mode - Pass 2: STRUCTURING

Convert the following Pass 1 analysis into the required JSON schema format.

Pass 1 Analysis:
${reasoningResponse.text}`;

    const structuringDeveloperMessage = capabilities.developerRole
      ? `You are in STRUCTURING MODE for span labeling.

TASK: Convert the Pass 1 free-form analysis into the required JSON schema.

Pass 1 Analysis:
${reasoningResponse.text}

Convert this analysis to the required JSON format.`
      : undefined;

    const structuredResponse = await callModel({
      systemPrompt: structuringPrompt,
      userPayload: JSON.stringify({
        task: 'Convert the Pass 1 analysis into structured JSON spans following the schema.',
        policy: payloadData.policy,
        text: payloadData.text,
        templateVersion: payloadData.templateVersion,
      }),
      aiService,
      maxTokens: Math.floor(maxTokens * 0.4),
      providerOptions: {
        ...providerOptions,
        developerMessage: structuringDeveloperMessage,
      },
      schema,
    });

    logger.info('Pass 2 (structuring) completed', {
      provider: providerName,
      usedDeveloperMessage: !!structuringDeveloperMessage,
    });

    return structuredResponse;
  }

  /**
   * Check if schema is complex enough for two-pass
   */
  private _isComplexSchemaForSpans(): boolean {
    return true; // Span labeling schema is always complex
  }

  /**
   * Get model config for an operation
   */
  protected _getModelConfig(aiService: BaseAIService, operation: string): { model?: string } | null {
    const envModel = process.env.SPAN_MODEL;
    if (envModel) {
      return { model: envModel };
    }
    
    if (operation.includes('mini') || operation.includes('draft')) {
      return { model: 'gpt-4o-mini-2024-07-18' };
    }
    
    return null;
  }

  /**
   * Inject defensive metadata
   */
  private _injectDefensiveMeta(
    value: Record<string, unknown>,
    options: ProcessingOptions,
    nlpSpansAttempted?: number
  ): void {
    if (!value) return;

    if (typeof value.analysis_trace !== 'string') {
      value.analysis_trace = `Analyzed input text and identified ${Array.isArray(value.spans) ? value.spans.length : 0} potential spans for labeling.`;
    }

    if (!value.meta || typeof value.meta !== 'object') {
      value.meta = {
        version: options.templateVersion || 'v1',
        notes: `Labeled ${Array.isArray(value.spans) ? value.spans.length : 0} spans`,
      };
    } else {
      const meta = value.meta as Record<string, unknown>;
      if (!meta.version) {
        meta.version = options.templateVersion || 'v1';
      }
      if (typeof meta.notes !== 'string') {
        meta.notes = '';
      }
    }

    if (SpanLabelingConfig.NLP_FAST_PATH.TRACK_METRICS && nlpSpansAttempted !== undefined && nlpSpansAttempted > 0) {
      const meta = value.meta as Record<string, unknown>;
      meta.nlpAttempted = true;
      meta.nlpSpansFound = nlpSpansAttempted;
      meta.nlpBypassFailed = true;
    }
  }

  /**
   * Attempt repair on validation failure
   */
  private async _attemptRepair({
    basePayload,
    validationErrors,
    originalResponse,
    text,
    policy,
    options,
    aiService,
    cache,
    estimatedMaxTokens,
    providerOptions,
    schema,
  }: {
    basePayload: Record<string, unknown>;
    validationErrors: string[];
    originalResponse: Record<string, unknown>;
    text: string;
    policy: ValidationPolicy;
    options: ProcessingOptions;
    aiService: BaseAIService;
    cache: SubstringPositionCache;
    estimatedMaxTokens: number;
    providerOptions: ProviderRequestOptions;
    schema?: Record<string, unknown>;
  }): Promise<LabelSpansResult> {
    const repairPayload = {
      ...basePayload,
      validation: {
        errors: validationErrors,
        originalResponse,
        instructions:
          'Fix the indices and roles described above without changing span text. Do not invent new spans.',
      },
    };

    const repairResponse = await callModel({
      systemPrompt: `${BASE_SYSTEM_PROMPT}

If validation feedback is provided, correct the issues without altering span text.`,
      userPayload: buildUserPayload(repairPayload),
      aiService,
      maxTokens: estimatedMaxTokens,
      providerOptions,
      schema,
    });

    this._lastResponseMetadata = repairResponse.metadata;

    const parsedRepair = parseJson(repairResponse.text);
    if (!parsedRepair.ok) {
      throw new Error(parsedRepair.error);
    }

    validateSchemaOrThrow(parsedRepair.value, schema);

    const validation = validateSpans({
      spans: parsedRepair.value.spans || [],
      meta: parsedRepair.value.meta,
      text,
      policy,
      options,
      attempt: 2,
      cache,
      isAdversarial:
        parsedRepair.value?.isAdversarial === true ||
        parsedRepair.value?.is_adversarial === true,
      analysisTrace: parsedRepair.value.analysis_trace || null,
    });

    if (!validation.ok) {
      const errorMessage = formatValidationErrors(validation.errors);
      throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
    }

    return validation.result;
  }
}
