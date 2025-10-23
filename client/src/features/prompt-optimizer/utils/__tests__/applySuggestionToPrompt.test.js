import { describe, it, expect } from 'vitest';
import { applySuggestionToPrompt } from '../applySuggestion.js';

describe('applySuggestionToPrompt', () => {
  it('replaces the intended occurrence using context metadata', () => {
    const prompt = 'Paint the wall red. Paint the wall red again.';
    const phrase = 'Paint the wall red';
    const firstStart = prompt.indexOf(phrase);
    const secondStart = prompt.indexOf(phrase, firstStart + 1);

    const result = applySuggestionToPrompt({
      prompt,
      suggestionText: 'Paint the wall crimson',
      highlight: phrase,
      spanMeta: {
        start: secondStart,
        end: secondStart + phrase.length,
        quote: phrase,
        leftCtx: prompt.slice(Math.max(0, secondStart - 10), secondStart),
        rightCtx: prompt.slice(secondStart + phrase.length, secondStart + phrase.length + 10),
        idempotencyKey: 'span_2-key',
      },
      metadata: {},
      offsets: { start: secondStart, end: secondStart + phrase.length },
    });

    expect(result.updatedPrompt).toBe('Paint the wall red. Paint the wall crimson again.');
    expect(result.replacementTarget).toBe(phrase);
  });
});
