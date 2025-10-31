import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { callOpenAI } from '../openAIClient.js';
import { SubstringPositionCache } from './cache/SubstringPositionCache.js';
import SpanLabelingConfig from './config/SpanLabelingConfig.js';
import { sanitizePolicy, sanitizeOptions, buildTaskDescription } from './utils/policyUtils.js';
import { parseJson, buildUserPayload } from './utils/jsonUtils.js';
import { formatValidationErrors } from './utils/textUtils.js';
import { validateSchemaOrThrow } from './validation/SchemaValidator.js';
import { validateSpans } from './validation/SpanValidator.js';

/**
 * Span Labeling Service - Refactored Architecture
 *
 * Orchestrates LLM-based span labeling with validation and optional repair.
 * This service is a thin orchestrator delegating to specialized modules:
 * - Config: Centralized configuration
 * - Utils: Text, JSON, and policy utilities
 * - Cache: Performance-optimized substring position caching
 * - Validation: Schema and span validation
 * - Processing: Pipeline of span transformations (dedupe, overlap, filter, truncate)
 */

// Load system prompt template
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptTemplatePath = join(__dirname, 'templates', 'span-labeling-prompt.md');
const BASE_SYSTEM_PROMPT = readFileSync(promptTemplatePath, 'utf-8')
  .replace(/^# .*$/gm, '') // Remove markdown headers
  .replace(/^##+ /gm, '')  // Remove heading markers
  .replace(/\*\*/g, '')    // Remove bold markers
  .replace(/```json[\s\S]*?```/gm, '') // Remove code blocks
  .trim()
  .replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines

/**
 * Call LLM with system prompt and user payload
 * @private
 */
async function callModel({ systemPrompt, userPayload, callFn, maxTokens }) {
  const raw = await callFn({
    system: systemPrompt,
    user: userPayload,
    max_tokens: maxTokens,
    temperature: SpanLabelingConfig.MODEL_CONFIG.temperature,
  });
  return raw;
}

/**
 * Label spans using an LLM with validation and optional repair attempt.
 *
 * @param {Object} params
 * @param {string} params.text - Source text to label
 * @param {number} [params.maxSpans] - Maximum spans to identify
 * @param {number} [params.minConfidence] - Minimum confidence threshold
 * @param {Object} [params.policy] - Validation policy
 * @param {string} [params.templateVersion] - Template version
 * @param {boolean} [params.enableRepair] - Enable repair attempt on validation failure (default: false)
 * @param {Object} [options]
 * @param {Function} [options.callFn] - LLM call function (defaults to callOpenAI)
 * @returns {Promise<{spans: Array, meta: {version: string, notes: string}}>}
 */
export async function labelSpans(params, options = {}) {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  // Create request-scoped cache for concurrent request safety
  const cache = new SubstringPositionCache();

  try {
    const policy = sanitizePolicy(params.policy);
    const sanitizedOptions = sanitizeOptions({
      maxSpans: params.maxSpans,
      minConfidence: params.minConfidence,
      templateVersion: params.templateVersion,
    });

    const task = buildTaskDescription(sanitizedOptions.maxSpans);
    const estimatedMaxTokens = SpanLabelingConfig.estimateMaxTokens(sanitizedOptions.maxSpans);

    const basePayload = {
      task,
      policy,
      text: params.text,
      templateVersion: sanitizedOptions.templateVersion,
    };

    const callFn = typeof options.callFn === 'function' ? options.callFn : callOpenAI;

    // Primary LLM call
    const primaryResponse = await callModel({
      systemPrompt: BASE_SYSTEM_PROMPT,
      userPayload: buildUserPayload(basePayload),
      callFn,
      maxTokens: estimatedMaxTokens,
    });

    const parsedPrimary = parseJson(primaryResponse);
    if (!parsedPrimary.ok) {
      throw new Error(parsedPrimary.error);
    }

    // Validate schema
    validateSchemaOrThrow(parsedPrimary.value);

    // Validate spans (strict mode)
    let validation = validateSpans({
      spans: parsedPrimary.value.spans || [],
      meta: parsedPrimary.value.meta,
      text: params.text,
      policy,
      options: sanitizedOptions,
      attempt: 1,
      cache,
    });

    if (validation.ok) {
      return validation.result;
    }

    // Handle validation failure
    const enableRepair = params.enableRepair === true;

    if (!enableRepair) {
      // Lenient mode - drop invalid spans instead of failing
      validation = validateSpans({
        spans: parsedPrimary.value.spans || [],
        meta: parsedPrimary.value.meta,
        text: params.text,
        policy,
        options: sanitizedOptions,
        attempt: 2, // Lenient mode
        cache,
      });

      return validation.result;
    }

    // Repair attempt
    const validationErrors = validation.errors;
    const repairPayload = {
      ...basePayload,
      validation: {
        errors: validationErrors,
        originalResponse: parsedPrimary.value,
        instructions:
          'Fix the indices and roles described above without changing span text. Do not invent new spans.',
      },
    };

    const repairResponse = await callModel({
      systemPrompt: `${BASE_SYSTEM_PROMPT}

If validation feedback is provided, correct the issues without altering span text.`,
      userPayload: buildUserPayload(repairPayload),
      callFn,
      maxTokens: estimatedMaxTokens,
    });

    const parsedRepair = parseJson(repairResponse);
    if (!parsedRepair.ok) {
      throw new Error(parsedRepair.error);
    }

    // Validate repair schema
    validateSchemaOrThrow(parsedRepair.value);

    // Validate repair spans (lenient mode)
    validation = validateSpans({
      spans: parsedRepair.value.spans || [],
      meta: parsedRepair.value.meta,
      text: params.text,
      policy,
      options: sanitizedOptions,
      attempt: 2,
      cache,
    });

    if (!validation.ok) {
      const errorMessage = formatValidationErrors(validation.errors);
      throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
    }

    return validation.result;
  } catch (error) {
    // Re-throw errors to let caller handle them
    throw error;
  }
  // Cache is automatically garbage collected when function returns
}
