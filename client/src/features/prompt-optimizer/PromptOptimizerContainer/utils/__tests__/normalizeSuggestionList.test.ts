import { describe, expect, it } from 'vitest';
import { normalizeSuggestionList, type EnhancementSuggestionEntry } from '../normalizeSuggestionList';

describe('normalizeSuggestionList', () => {
  it('converts string entries into suggestion objects', () => {
    const input: Array<EnhancementSuggestionEntry | null | undefined> = [
      'Tighten pacing',
      { text: 'Improve continuity' },
    ];

    const result = normalizeSuggestionList(input);

    expect(result).toEqual([
      { text: 'Tighten pacing' },
      { text: 'Improve continuity' },
    ]);
  });

  it('flattens grouped suggestions and inherits group category without overriding child category', () => {
    const input: Array<EnhancementSuggestionEntry | null | undefined> = [
      {
        category: 'motion',
        suggestions: [
          'Add subtle dolly in',
          { text: 'Increase parallax', category: 'camera' },
          { text: 'Smooth transitions' },
        ],
      },
    ];

    const result = normalizeSuggestionList(input);

    expect(result).toEqual([
      { text: 'Add subtle dolly in', category: 'motion' },
      { text: 'Increase parallax', category: 'camera' },
      { text: 'Smooth transitions', category: 'motion' },
    ]);
  });

  it('skips nullish and non-object invalid entries', () => {
    const input = [
      null,
      undefined,
      5 as unknown as EnhancementSuggestionEntry,
      { text: 'Valid result' },
    ];

    const result = normalizeSuggestionList(input);

    expect(result).toEqual([{ text: 'Valid result' }]);
  });
});
