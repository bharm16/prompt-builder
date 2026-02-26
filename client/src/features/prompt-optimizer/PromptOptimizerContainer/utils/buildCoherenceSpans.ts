import type { HighlightSnapshot } from '@features/prompt-optimizer/PromptCanvas/types';
import type { CoherenceSpan } from '@features/prompt-optimizer/types/coherence';

export function buildCoherenceSpansFromSnapshot(
  snapshot: HighlightSnapshot | null,
  prompt: string
): CoherenceSpan[] {
  if (!snapshot || !Array.isArray(snapshot.spans) || !prompt) {
    return [];
  }

  const mapped = snapshot.spans.map((span, index): CoherenceSpan | null => {
    const start = typeof span.start === 'number' ? span.start : null;
    const end = typeof span.end === 'number' ? span.end : null;

    if (start === null || end === null || end <= start) {
      return null;
    }

    const safeStart = Math.max(0, Math.min(start, prompt.length));
    const safeEnd = Math.max(safeStart, Math.min(end, prompt.length));
    const text = prompt.slice(safeStart, safeEnd).trim();

    if (!text) {
      return null;
    }

    return {
      id: `span_${safeStart}_${safeEnd}_${index}`,
      start: safeStart,
      end: safeEnd,
      category: span.category,
      confidence: span.confidence,
      text,
      quote: text,
    };
  });

  return mapped.filter((span): span is CoherenceSpan => span !== null);
}
