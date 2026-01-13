import { buildUserPayload, parseJson } from '../../utils/jsonUtils';
import { formatValidationErrors } from '../../utils/textUtils';
import { buildSystemPrompt, BASE_SYSTEM_PROMPT } from '../../utils/promptBuilder';
import { validateSchemaOrThrow } from '../../validation/SchemaValidator';
import { validateSpans } from '../../validation/SpanValidator';
import type { UserPayloadParams } from '../../utils/jsonUtils';
import type { LabelSpansResult, ValidationPolicy, ProcessingOptions, LLMSpan, LLMMeta } from '../../types';
import type { AIService as BaseAIService } from '@services/enhancement/services/types';
import type { SubstringPositionCache } from '../../cache/SubstringPositionCache';
import { callModel, type ModelResponse, type ProviderRequestOptions } from './modelInvocation';

interface ParsedLLMResponse {
  spans?: LLMSpan[];
  meta?: LLMMeta;
  isAdversarial?: boolean;
  is_adversarial?: boolean;
  analysis_trace?: string | null;
  [key: string]: unknown;
}

export async function attemptRepair({
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
  providerName,
  parseResponseText,
  normalizeParsedResponse,
  injectDefensiveMeta,
}: {
  basePayload: UserPayloadParams;
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
  providerName: string;
  parseResponseText: (text: string) => ReturnType<typeof parseJson>;
  normalizeParsedResponse: <T extends Record<string, unknown>>(value: T) => T;
  injectDefensiveMeta: (
    value: Record<string, unknown>,
    options: ProcessingOptions,
    nlpSpansAttempted?: number
  ) => void;
}): Promise<{ result: LabelSpansResult; metadata?: ModelResponse['metadata'] }> {
  const repairPayload: UserPayloadParams = {
    ...basePayload,
    validation: {
      errors: validationErrors,
      originalResponse,
      instructions:
        'Fix the indices and roles described above without changing span text. Do not invent new spans.',
    },
  };

  const repairSystemPrompt = providerName === 'gemini'
    ? buildSystemPrompt('', false, providerName, Boolean(schema))
    : BASE_SYSTEM_PROMPT;

  const repairResponse = await callModel({
    systemPrompt: `${repairSystemPrompt}

If validation feedback is provided, correct the issues without altering span text.`,
    userPayload: buildUserPayload(repairPayload),
    aiService,
    maxTokens: estimatedMaxTokens,
    providerOptions,
    ...(schema && { schema }),
  });

  const parsedRepair = parseResponseText(repairResponse.text);
  if (!parsedRepair.ok) {
    throw new Error(parsedRepair.error);
  }

  let repairValue = parsedRepair.value as ParsedLLMResponse;

  repairValue = normalizeParsedResponse(repairValue) as ParsedLLMResponse;

  if (providerName === 'gemini') {
    injectDefensiveMeta(repairValue, options);
  }

  validateSchemaOrThrow(repairValue as Record<string, unknown>, schema);

  const validation = validateSpans({
    spans: repairValue.spans || [],
    meta: repairValue.meta ?? { version: 'v1', notes: '' },
    text,
    policy,
    options,
    attempt: 2,
    cache,
    isAdversarial:
      repairValue?.isAdversarial === true ||
      repairValue?.is_adversarial === true,
    analysisTrace: repairValue.analysis_trace || null,
  });

  if (!validation.ok) {
    const errorMessage = formatValidationErrors(validation.errors);
    throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
  }

  return { result: validation.result, metadata: repairResponse.metadata };
}
