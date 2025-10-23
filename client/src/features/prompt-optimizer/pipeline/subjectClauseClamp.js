import { createSpan } from './spanUtils.js';

const CLAUSE_BOUNDARY = /[,;:—]/;
const MAX_TOKENS = 12;

const shouldClampCategory = (span) => {
  if (span.source === 'CONTEXT') return false;
  if (span.category === 'technical') return false;
  return true;
};

const clampSpan = (canonical, span) => {
  if (!shouldClampCategory(span)) {
    return span;
  }

  const text = span.quote || '';
  if (!text) return span;

  let relativeEnd = text.length;

  const boundaryIndex = text.search(CLAUSE_BOUNDARY);
  if (boundaryIndex !== -1 && boundaryIndex > 0) {
    relativeEnd = Math.min(relativeEnd, boundaryIndex);
  }

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > MAX_TOKENS) {
    const trimmed = tokens.slice(0, MAX_TOKENS).join(' ');
    const matchIndex = text.indexOf(trimmed);
    if (matchIndex !== -1) {
      relativeEnd = Math.min(relativeEnd, matchIndex + trimmed.length);
    } else {
      relativeEnd = Math.min(relativeEnd, trimmed.length);
    }
  }

  if (relativeEnd >= text.length) {
    return span;
  }

  const newEnd = span.start + relativeEnd;
  if (newEnd <= span.start) {
    return span;
  }

  return createSpan({
    canonical,
    start: span.start,
    end: newEnd,
    category: span.category,
    source: span.source,
    confidence: span.confidence,
    metadata: { ...(span.metadata ?? {}), truncated: true },
  });
};

export const clampSpansToClauses = (canonical, spans) => spans.map((span) => clampSpan(canonical, span));
