import type { LabelSpansParams, ValidationPolicy } from '@llm/span-labeling/types';

export interface ParsedLabelSpansRequest {
  payload: LabelSpansParams;
  text: string;
  maxSpans?: number;
  minConfidence?: number;
  policy?: ValidationPolicy;
  templateVersion?: string;
}

export type LabelSpansRequestParseResult =
  | { ok: true; data: ParsedLabelSpansRequest }
  | { ok: false; status: number; error: string };

const sanitizeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

export function parseLabelSpansRequest(
  body: unknown
): LabelSpansRequestParseResult {
  const { text, maxSpans, minConfidence, policy, templateVersion } =
    (body || {}) as {
      text?: unknown;
      maxSpans?: unknown;
      minConfidence?: unknown;
      policy?: ValidationPolicy;
      templateVersion?: string;
    };

  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, status: 400, error: 'text is required' };
  }

  const safeMaxSpans = sanitizeNumber(maxSpans);
  if (
    safeMaxSpans !== undefined &&
    (!Number.isInteger(safeMaxSpans) || safeMaxSpans <= 0 || safeMaxSpans > 80)
  ) {
    return {
      ok: false,
      status: 400,
      error: 'maxSpans must be an integer between 1 and 80',
    };
  }

  const safeMinConfidence = sanitizeNumber(minConfidence);
  if (
    safeMinConfidence !== undefined &&
    (typeof safeMinConfidence !== 'number' ||
      Number.isNaN(safeMinConfidence) ||
      safeMinConfidence < 0 ||
      safeMinConfidence > 1)
  ) {
    return {
      ok: false,
      status: 400,
      error: 'minConfidence must be between 0 and 1',
    };
  }

  const payload: LabelSpansParams = {
    text,
    ...(safeMaxSpans !== undefined ? { maxSpans: safeMaxSpans } : {}),
    ...(safeMinConfidence !== undefined ? { minConfidence: safeMinConfidence } : {}),
    ...(policy ? { policy } : {}),
    ...(templateVersion ? { templateVersion } : {}),
  };

  return {
    ok: true,
    data: {
      payload,
      text,
      ...(safeMaxSpans !== undefined ? { maxSpans: safeMaxSpans } : {}),
      ...(safeMinConfidence !== undefined
        ? { minConfidence: safeMinConfidence }
        : {}),
      ...(policy ? { policy } : {}),
      ...(templateVersion ? { templateVersion } : {}),
    },
  };
}
