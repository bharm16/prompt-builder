import { describe, it, expect } from 'vitest';
import {
  convertLabeledSpansToHighlights,
  type LLMSpan,
} from '../highlightConversion';

const sampleText = 'A cowboy in a leather jacket walks along the dusty road';

describe('highlightConversion', () => {
  it('returns empty array for missing spans or text', () => {
    expect(convertLabeledSpansToHighlights({ spans: null as unknown as LLMSpan[], text: sampleText })).toEqual([]);
    expect(convertLabeledSpansToHighlights({ spans: [], text: '' })).toEqual([]);
  });

  it('normalizes taxonomy and legacy roles', () => {
    const spans: LLMSpan[] = [
      { role: 'subject.wardrobe', start: 14, end: 28 },
      { role: 'Wardrobe', start: 14, end: 28 },
      { role: 'UnknownRole', start: 0, end: 1 },
    ];

    const highlights = convertLabeledSpansToHighlights({ spans, text: sampleText });
    const categories = highlights.map((h) => h.category);

    expect(categories).toContain('subject.wardrobe');
    expect(categories).toContain('subject');
  });

  it('drops spans that clamp to an empty range', () => {
    const spans: LLMSpan[] = [{ role: 'subject', start: 10_000, end: 10_010 }];
    const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
    expect(result).toEqual([]);
  });

  it('merges adjacent spans with the same category', () => {
    const text = 'soft light  warm glow';
    const firstPhrase = 'soft light';
    const secondPhrase = 'warm glow';
    const firstStart = text.indexOf(firstPhrase);
    const firstEnd = firstStart + firstPhrase.length;
    const secondStart = text.indexOf(secondPhrase);
    const secondEnd = secondStart + secondPhrase.length;
    const spans: LLMSpan[] = [
      { role: 'lighting.quality', start: firstStart, end: firstEnd },
      { role: 'lighting.quality', start: secondStart, end: secondEnd },
    ];

    const result = convertLabeledSpansToHighlights({ spans, text });
    expect(result).toHaveLength(1);
    expect(result[0]?.quote).toBe(text.slice(firstStart, secondEnd));
  });

  it('includes grapheme indices when canonical mapping is provided', () => {
    const spans: LLMSpan[] = [{ role: 'subject', start: 2, end: 8 }];
    const result = convertLabeledSpansToHighlights({
      spans,
      text: sampleText,
      canonical: {
        graphemeIndexForCodeUnit: (idx: number) => idx * 2,
      },
    });

    expect(result[0]?.startGrapheme).toBe(4);
    expect(result[0]?.endGrapheme).toBe(16);
  });
});
