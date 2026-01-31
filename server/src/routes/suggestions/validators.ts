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

function validationError(message: string): ValidationFailure {
  return { ok: false, status: 400, error: 'Invalid request', message };
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

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      { suggestions, context: ctxResult.data },
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

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric({ suggestion, context: ctxResult.data }, rubric),
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

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      {
        setA,
        setB,
        context: ctxResult.data,
      },
      rubric
    ),
  };
}
