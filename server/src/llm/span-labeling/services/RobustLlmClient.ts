import { SubstringPositionCache } from '../cache/SubstringPositionCache.js';
import SpanLabelingConfig from '../config/SpanLabelingConfig.js';
import { sanitizePolicy, sanitizeOptions, buildTaskDescription } from '../utils/policyUtils.js';
import { parseJson, buildUserPayload } from '../utils/jsonUtils.js';
import { formatValidationErrors } from '../utils/textUtils.js';
import { validateSchemaOrThrow } from '../validation/SchemaValidator.js';
import { validateSpans } from '../validation/SpanValidator.js';
import { buildSystemPrompt, BASE_SYSTEM_PROMPT } from '../utils/promptBuilder.ts';
import type { LabelSpansParams, LabelSpansResult, ValidationPolicy, ProcessingOptions } from '../types.js';
import type { AIService as BaseAIService } from '../../../types.js';

interface LlmSpanParams {
  text: string;
  policy: ValidationPolicy;
  options: ProcessingOptions;
  enableRepair: boolean;
  aiService: BaseAIService;
  cache: SubstringPositionCache;
  nlpSpansAttempted?: number;
}

/**
 * Call LLM with system prompt and user payload using AIModelService
 */
async function callModel({
  systemPrompt,
  userPayload,
  aiService,
  maxTokens,
  enableBookending = true,
}: {
  systemPrompt: string;
  userPayload: string;
  aiService: BaseAIService;
  maxTokens: number;
  enableBookending?: boolean;
}): Promise<string> {
  const response = await aiService.execute('span_labeling', {
    systemPrompt,
    userMessage: userPayload,
    maxTokens,
    jsonMode: true, // Enforce structured output per PDF guidance
    enableBookending, // GPT-4o Best Practices: Bookending strategy
    // temperature is configured in modelConfig.js
  });

  // Extract text from response
  // Response format: { text: string, metadata: {...} }
  // Handle both formats for backward compatibility
  if (response.text) {
    return response.text;
  }
  if (response.content && Array.isArray(response.content) && response.content.length > 0) {
    return response.content[0]?.text || '';
  }
  return '';
}

/**
 * Robust LLM Client
 *
 * Encapsulates the "try, validate, repair" cycle for LLM-based span labeling.
 * Handles defensive metadata injection, validation, and repair attempts.
 */
export class RobustLlmClient {
  /**
   * Get spans using LLM with validation and optional repair
   *
   * @param params - Parameters for LLM span extraction
   * @returns Label spans result
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

    // PDF Design B: Use context-aware system prompt with semantic routing
    const contextAwareSystemPrompt = buildSystemPrompt(text, true);

    // GPT-4o Best Practices: Two-Pass Architecture for GPT-4o-mini with complex schemas
    // Check if we're using GPT-4o-mini and if schema is complex
    // For span labeling, we always use two-pass when using mini models for better accuracy
    const config = this._getModelConfig(aiService, 'span_labeling');
    const isMini = config?.model?.includes('mini') || 
                   config?.model?.includes('gpt-4o-mini') ||
                   process.env.SPAN_MODEL?.includes('mini') ||
                   process.env.SPAN_MODEL?.includes('gpt-4o-mini');
    const hasComplexSchema = this._isComplexSchemaForSpans();

    let primaryResponse: string;

    if (isMini && hasComplexSchema) {
      // Two-Pass Architecture: Pass 1 (Reasoning) + Pass 2 (Structuring)
      primaryResponse = await this._twoPassExtraction({
        systemPrompt: contextAwareSystemPrompt,
        userPayload: buildUserPayload(basePayload),
        aiService,
        maxTokens: estimatedMaxTokens,
      });
    } else {
      // Standard single-pass extraction with bookending enabled
      primaryResponse = await callModel({
        systemPrompt: contextAwareSystemPrompt,
        userPayload: buildUserPayload(basePayload),
        aiService,
        maxTokens: estimatedMaxTokens,
        enableBookending: true,
      });
    }

    const parsedPrimary = parseJson(primaryResponse);
    if (!parsedPrimary.ok) {
      throw new Error(parsedPrimary.error);
    }

    // DEFENSIVE: Inject default meta if LLM omitted it
    // Groq/Llama models sometimes optimize by omitting "optional" fields
    // This ensures schema validation always passes
    this._injectDefensiveMeta(parsedPrimary.value, options, nlpSpansAttempted);

    // Validate schema (should pass now with defensive meta injection)
    validateSchemaOrThrow(parsedPrimary.value);

    const isAdversarial =
      parsedPrimary.value?.isAdversarial === true ||
      parsedPrimary.value?.is_adversarial === true;

    if (isAdversarial) {
      // Immediately exit with an empty set while preserving the adversarial flag
      const validation = validateSpans({
        spans: [],
        meta: parsedPrimary.value.meta,
        text,
        policy,
        options,
        attempt: 1,
        cache,
        isAdversarial: true,
      });

      return validation.result;
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
    });

    if (validation.ok) {
      return validation.result;
    }

    // Handle validation failure
    if (!enableRepair) {
      // Lenient mode - drop invalid spans instead of failing
      validation = validateSpans({
        spans: parsedPrimary.value.spans || [],
        meta: parsedPrimary.value.meta,
        text,
        policy,
        options,
        attempt: 2, // Lenient mode
        cache,
        isAdversarial,
      });

      return validation.result;
    }

    // Repair attempt
    return this._attemptRepair({
      basePayload,
      validationErrors: validation.errors,
      originalResponse: parsedPrimary.value,
      text,
      policy,
      options,
      aiService,
      cache,
      estimatedMaxTokens,
    });
  }

  /**
   * GPT-4o Best Practices: Two-Pass Architecture for GPT-4o-mini
   * Pass 1: Free-text analysis (reasoning without schema constraints)
   * Pass 2: Structure the analysis into JSON schema
   * 
   * This splits "Cognitive Load" (Understanding) from "Syntactic Load" (Formatting)
   */
  private async _twoPassExtraction({
    systemPrompt,
    userPayload,
    aiService,
    maxTokens,
  }: {
    systemPrompt: string;
    userPayload: string;
    aiService: BaseAIService;
    maxTokens: number;
  }): Promise<string> {
    const payloadData = JSON.parse(userPayload);
    
    // Pass 1: Free-text reasoning (no schema constraints)
    const reasoningPrompt = `${systemPrompt}

## Two-Pass Analysis Mode - Pass 1: REASONING

Analyze the input text and identify ALL key entities, relationships, and span boundaries.
Think step-by-step about what should be labeled.
Output your analysis in free text / markdown format.
Do NOT worry about JSON structure yet - just reason through the task.

Focus on:
1. What entities are present?
2. What are their relationships?
3. What are the natural span boundaries?
4. What taxonomy categories apply?`;

    const reasoningResponse = await callModel({
      systemPrompt: reasoningPrompt,
      userPayload: JSON.stringify({
        task: 'Analyze the text and provide step-by-step reasoning about what spans should be labeled.',
        policy: payloadData.policy,
        text: payloadData.text,
        templateVersion: payloadData.templateVersion,
      }),
      aiService,
      maxTokens: Math.floor(maxTokens * 0.6), // Use 60% of tokens for reasoning
      enableBookending: false, // No bookending needed for reasoning pass
    });

    // Pass 2: Structure the reasoning into JSON schema
    const structuringPrompt = `${systemPrompt}

## Two-Pass Analysis Mode - Pass 2: STRUCTURING

Convert the following Pass 1 analysis into the required JSON schema format.
Use the reasoning from Pass 1 to inform your span labeling.
Follow the schema exactly as specified.

Pass 1 Analysis:
${reasoningResponse}

Now convert this analysis into the structured JSON format required.`;

    return await callModel({
      systemPrompt: structuringPrompt,
      userPayload: JSON.stringify({
        task: 'Convert the Pass 1 analysis into structured JSON spans following the schema.',
        policy: payloadData.policy,
        text: payloadData.text,
        templateVersion: payloadData.templateVersion,
      }),
      aiService,
      maxTokens: Math.floor(maxTokens * 0.4), // Use 40% of tokens for structuring
      enableBookending: true, // Enable bookending for structuring pass
    });
  }

  /**
   * Check if schema is complex enough to warrant two-pass architecture
   */
  private _isComplexSchemaForSpans(): boolean {
    // Span labeling schema is considered complex if:
    // - Has many taxonomy categories
    // - Requires reasoning about relationships
    // - Has nested structures
    
    // For now, always use two-pass for span labeling with GPT-4o-mini
    // as it requires significant reasoning about entity relationships
    return true;
  }

  /**
   * Get model config for an operation (helper method)
   * Checks environment variables and defaults to detecting mini from operation name
   */
  private _getModelConfig(aiService: BaseAIService, operation: string): { model?: string } | null {
    // Check environment variable first
    const envModel = process.env.SPAN_MODEL;
    if (envModel) {
      return { model: envModel };
    }
    
    // Check if operation name suggests mini
    if (operation.includes('mini') || operation.includes('draft')) {
      return { model: 'gpt-4o-mini-2024-07-18' };
    }
    
    return null;
  }

  /**
   * Inject defensive metadata to ensure schema validation passes
   * @private
   */
  private _injectDefensiveMeta(
    value: Record<string, unknown>,
    options: ProcessingOptions,
    nlpSpansAttempted?: number
  ): void {
    if (!value) return;

    // Inject analysis_trace if missing (Chain-of-Thought reasoning field)
    if (typeof value.analysis_trace !== 'string') {
      value.analysis_trace = `Analyzed input text and identified ${Array.isArray(value.spans) ? value.spans.length : 0} potential spans for labeling.`;
    }

    if (!value.meta || typeof value.meta !== 'object') {
      value.meta = {
        version: options.templateVersion || 'v1',
        notes: `Labeled ${Array.isArray(value.spans) ? value.spans.length : 0} spans`,
      };
    } else {
      // Ensure meta has required sub-fields
      const meta = value.meta as Record<string, unknown>;
      if (!meta.version) {
        meta.version = options.templateVersion || 'v1';
      }
      if (typeof meta.notes !== 'string') {
        meta.notes = '';
      }
    }

    // Add NLP attempt metrics if tracking is enabled
    if (SpanLabelingConfig.NLP_FAST_PATH.TRACK_METRICS && nlpSpansAttempted !== undefined && nlpSpansAttempted > 0) {
      const meta = value.meta as Record<string, unknown>;
      meta.nlpAttempted = true;
      meta.nlpSpansFound = nlpSpansAttempted;
      meta.nlpBypassFailed = true;
    }
  }

  /**
   * Attempt to repair invalid spans by calling LLM again with validation feedback
   * @private
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
    });

    const parsedRepair = parseJson(repairResponse);
    if (!parsedRepair.ok) {
      throw new Error(parsedRepair.error);
    }

    // Validate repair schema
    validateSchemaOrThrow(parsedRepair.value);

    // Validate repair spans (lenient mode)
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
    });

    if (!validation.ok) {
      const errorMessage = formatValidationErrors(validation.errors);
      throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
    }

    return validation.result;
  }
}

