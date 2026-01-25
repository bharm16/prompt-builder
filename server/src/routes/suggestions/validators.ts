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

function validationError(message: string): ValidationFailure {
  return { ok: false, status: 400, error: 'Invalid request', message };
}

function extractContext(
  context: unknown
): ValidationResult<SuggestionsContext> {
  const ctx = context as Record<string, unknown> | undefined;
  if (!ctx || !ctx.highlightedText) {
    return validationError('context.highlightedText is required');
  }
  return {
    ok: true,
    data: { highlightedText: ctx.highlightedText as string, ...ctx } as SuggestionsContext,
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

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      { suggestions: suggestions as Array<{ text: string }>, context: ctxResult.data },
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

  const ctxResult = extractContext(context);
  if (!ctxResult.ok) return ctxResult;

  return {
    ok: true,
    data: withOptionalRubric(
      {
        setA: setA as Array<{ text: string }>,
        setB: setB as Array<{ text: string }>,
        context: ctxResult.data,
      },
      rubric
    ),
  };
}
