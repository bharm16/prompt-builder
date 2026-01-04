import type { LabelSpansResult, LLMSpan } from '@llm/span-labeling/types';

export interface PublicSpan {
  text: string;
  start?: number;
  end?: number;
  category: string;
  confidence?: number;
}

export interface PublicLabelSpansResult extends Omit<LabelSpansResult, 'spans'> {
  spans: PublicSpan[];
}

export const toPublicSpan = (span: LLMSpan): PublicSpan => ({
  text: span.text,
  start: span.start,
  end: span.end,
  category: span.role,
  confidence: span.confidence,
});

export const toPublicLabelSpansResult = (
  result: LabelSpansResult
): PublicLabelSpansResult => ({
  ...result,
  spans: Array.isArray(result.spans) ? result.spans.map(toPublicSpan) : [],
});
