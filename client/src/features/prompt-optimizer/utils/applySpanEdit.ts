import { relocateQuote } from '@utils/textQuoteRelocator';
import type { CoherenceEdit, CoherenceSpan } from '../types/coherence';

export interface ApplySpanEditResult {
  updatedPrompt: string | null;
  matchStart?: number;
  matchEnd?: number;
}

const ensureNumber = (value: unknown): number | null =>
  Number.isFinite(value) ? Number(value) : null;

const buildContextWindow = (
  prompt: string,
  start: number | null,
  end: number | null,
  windowSize = 24
): { leftCtx: string; rightCtx: string } => {
  if (typeof start !== 'number' || typeof end !== 'number') {
    return { leftCtx: '', rightCtx: '' };
  }
  const leftCtx = prompt.slice(Math.max(0, start - windowSize), start);
  const rightCtx = prompt.slice(end, Math.min(prompt.length, end + windowSize));
  return { leftCtx, rightCtx };
};

export function applySpanEditToPrompt({
  prompt,
  edit,
  span,
}: {
  prompt: string;
  edit: CoherenceEdit;
  span?: CoherenceSpan | null;
}): ApplySpanEditResult {
  if (!prompt) {
    return { updatedPrompt: null };
  }

  const quote =
    (span?.quote || span?.text || edit.anchorQuote || '').trim();
  if (!quote) {
    return { updatedPrompt: null };
  }

  const preferIndex = ensureNumber(span?.start);
  const { leftCtx, rightCtx } = buildContextWindow(prompt, span?.start ?? null, span?.end ?? null);
  const match = relocateQuote({
    text: prompt,
    quote,
    leftCtx: span?.leftCtx || leftCtx,
    rightCtx: span?.rightCtx || rightCtx,
    preferIndex,
  });

  if (!match) {
    return { updatedPrompt: null };
  }

  const replacementText =
    edit.type === 'replaceSpanText' ? edit.replacementText ?? '' : '';

  const prefix = prompt.slice(0, match.start);
  const suffix = prompt.slice(match.end);
  const updatedPrompt = `${prefix}${replacementText}${suffix}`;

  if (updatedPrompt === prompt) {
    return { updatedPrompt: null };
  }

  return {
    updatedPrompt,
    matchStart: match.start,
    matchEnd: match.end,
  };
}
