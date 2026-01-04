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

export function validateEvaluateRequest(
  body: any
): ValidationResult<{
  suggestions: Array<{ text: string }>;
  context: SuggestionsContext;
  rubric?: string;
}> {
  const { suggestions, context, rubric } = body || {};

  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid request',
      message: 'suggestions must be a non-empty array',
    };
  }

  if (!context || !context.highlightedText) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid request',
      message: 'context.highlightedText is required',
    };
  }

  return {
    ok: true,
    data: { suggestions, context, rubric },
  };
}

export function validateSingleEvaluationRequest(
  body: any
): ValidationResult<{
  suggestion: string;
  context: SuggestionsContext;
  rubric?: string;
}> {
  const { suggestion, context, rubric } = body || {};

  if (!suggestion || typeof suggestion !== 'string') {
    return {
      ok: false,
      status: 400,
      error: 'Invalid request',
      message: 'suggestion must be a string',
    };
  }

  if (!context || !context.highlightedText) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid request',
      message: 'context.highlightedText is required',
    };
  }

  return {
    ok: true,
    data: { suggestion, context, rubric },
  };
}

export function validateCompareRequest(
  body: any
): ValidationResult<{
  setA: Array<{ text: string }>;
  setB: Array<{ text: string }>;
  context: SuggestionsContext;
  rubric?: string;
}> {
  const { setA, setB, context, rubric } = body || {};

  if (!Array.isArray(setA) || !Array.isArray(setB)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid request',
      message: 'setA and setB must be arrays',
    };
  }

  if (!context || !context.highlightedText) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid request',
      message: 'context.highlightedText is required',
    };
  }

  return {
    ok: true,
    data: { setA, setB, context, rubric },
  };
}
