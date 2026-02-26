interface ValidationFailure {
  ok: false;
  status: number;
  error: string;
  message: string;
}

interface ValidationSuccess<T> {
  ok: true;
  data: T;
}

type ValidationResult<T> = ValidationFailure | ValidationSuccess<T>;

export interface SuggestionsContext {
  highlightedText: string;
  fullPrompt?: string;
  isVideoPrompt?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSuggestion = (value: unknown): value is { text: string } =>
  isRecord(value) && typeof value.text === 'string';

const isSuggestionArray = (value: unknown[]): value is Array<{ text: string }> =>
  value.every(isSuggestion);

const MIN_SUGGESTION_LENGTH = 3;
const MAX_SUGGESTION_LENGTH = 300;
const PLACEHOLDER_TEXT_PATTERNS: RegExp[] = [
  /^(?:tbd|todo|placeholder|n\/a|none|null)$/i,
  /^\[(?:insert|placeholder|todo|tbd)[^\]]*\]$/i,
  /^<(?:insert|placeholder|todo|tbd)[^>]*>$/i,
  /^(?:insert|add|write)\s+(?:text|suggestion|value)\b/i,
  /^(?:your|sample)\s+(?:text|suggestion|value)\b/i,
];

function validationError(message: string): ValidationFailure {
  return { ok: false, status: 400, error: 'Invalid request', message };
}

function normalizeSuggestionText(
  text: string,
  fieldPath: string
): ValidationResult<string> {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return validationError(`${fieldPath} must not be empty`);
  }

  if (normalized.length < MIN_SUGGESTION_LENGTH) {
    return validationError(
      `${fieldPath} must be at least ${MIN_SUGGESTION_LENGTH} characters`
    );
  }

  if (normalized.length > MAX_SUGGESTION_LENGTH) {
    return validationError(
      `${fieldPath} must be at most ${MAX_SUGGESTION_LENGTH} characters`
    );
  }

  if (PLACEHOLDER_TEXT_PATTERNS.some((pattern) => pattern.test(lower))) {
    return validationError(`${fieldPath} must not be placeholder-like text`);
  }

  return { ok: true, data: normalized };
}

function extractContext(
  context: unknown
): ValidationResult<SuggestionsContext> {
  if (!isRecord(context)) {
    return validationError('context.highlightedText is required');
  }
  const highlightedText = context.highlightedText;
  if (typeof highlightedText !== 'string' || highlightedText.length === 0) {
    return validationError('context.highlightedText is required');
  }
  const fullPrompt = typeof context.fullPrompt === 'string' ? context.fullPrompt : undefined;
  const isVideoPrompt =
    typeof context.isVideoPrompt === 'boolean' ? context.isVideoPrompt : undefined;
  return {
    ok: true,
    data: {
      highlightedText,
      ...(fullPrompt !== undefined ? { fullPrompt } : {}),
      ...(isVideoPrompt !== undefined ? { isVideoPrompt } : {}),
    },
  };
}

function withOptionalRubric<T extends Record<string, unknown>>(
  data: T,
  rubric: unknown
): T & { rubric?: string } {
  if (typeof rubric === 'string') {
    return { ...data, rubric };
  }
  return data;
}

export function validateEvaluateRequest(
  body: Record<string, unknown>
): ValidationResult<{
  suggestions: Array<{ text: string }>;
  context: SuggestionsContext;
  rubric?: string;
}> {
  const { suggestions, context, rubric } = body;

  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    return validationError('suggestions must be a non-empty array');
  }
  if (!isSuggestionArray(suggestions)) {
    return validationError('suggestions must be an array of { text: string }');
  }

  const normalizedSuggestions: Array<{ text: string }> = [];
  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    if (!suggestion) {
      return validationError(`suggestions[${i}] must be defined`);
    }
    const normalizedText = normalizeSuggestionText(
      suggestion.text,
      `suggestions[${i}].text`
    );
    if (!normalizedText.ok) {
      return normalizedText;
    }
    normalizedSuggestions.push({
      ...suggestion,
      text: normalizedText.data,
    });
  }

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      { suggestions: normalizedSuggestions, context: ctxResult.data },
      rubric
    ),
  };
}

export function validateSingleEvaluationRequest(
  body: Record<string, unknown>
): ValidationResult<{
  suggestion: string;
  context: SuggestionsContext;
  rubric?: string;
}> {
  const { suggestion, context, rubric } = body;

  if (!suggestion || typeof suggestion !== 'string') {
    return validationError('suggestion must be a string');
  }

  const normalizedSuggestion = normalizeSuggestionText(suggestion, 'suggestion');
  if (!normalizedSuggestion.ok) {
    return normalizedSuggestion;
  }

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      { suggestion: normalizedSuggestion.data, context: ctxResult.data },
      rubric
    ),
  };
}

export function validateCompareRequest(
  body: Record<string, unknown>
): ValidationResult<{
  setA: Array<{ text: string }>;
  setB: Array<{ text: string }>;
  context: SuggestionsContext;
  rubric?: string;
}> {
  const { setA, setB, context, rubric } = body;

  if (!Array.isArray(setA) || !Array.isArray(setB)) {
    return validationError('setA and setB must be arrays');
  }
  if (!isSuggestionArray(setA) || !isSuggestionArray(setB)) {
    return validationError('setA and setB must contain { text: string } entries');
  }

  const normalizedSetA: Array<{ text: string }> = [];
  for (let i = 0; i < setA.length; i++) {
    const suggestion = setA[i];
    if (!suggestion) {
      return validationError(`setA[${i}] must be defined`);
    }
    const normalizedText = normalizeSuggestionText(
      suggestion.text,
      `setA[${i}].text`
    );
    if (!normalizedText.ok) {
      return normalizedText;
    }
    normalizedSetA.push({
      ...suggestion,
      text: normalizedText.data,
    });
  }

  const normalizedSetB: Array<{ text: string }> = [];
  for (let i = 0; i < setB.length; i++) {
    const suggestion = setB[i];
    if (!suggestion) {
      return validationError(`setB[${i}] must be defined`);
    }
    const normalizedText = normalizeSuggestionText(
      suggestion.text,
      `setB[${i}].text`
    );
    if (!normalizedText.ok) {
      return normalizedText;
    }
    normalizedSetB.push({
      ...suggestion,
      text: normalizedText.data,
    });
  }

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      {
        setA: normalizedSetA,
        setB: normalizedSetB,
        context: ctxResult.data,
      },
      rubric
    ),
  };
}
