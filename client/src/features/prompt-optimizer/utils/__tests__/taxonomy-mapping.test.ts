import { describe, it, expect } from 'vitest';
import { convertLabeledSpansToHighlights } from '../highlightConversion';
import { VALID_CATEGORIES } from '@shared/taxonomy';

describe('taxonomy mapping', () => {
  const text = 'A detective in a leather jacket walks with determination';

  it('preserves taxonomy IDs for subject attributes', () => {
    const spans = [
      { text: 'detective', start: 2, end: 11, role: 'subject.identity' },
      { text: 'leather jacket', start: 17, end: 31, role: 'subject.wardrobe' },
      { text: 'walks', start: 32, end: 37, role: 'action.movement' },
    ];

    const highlights = convertLabeledSpansToHighlights({ spans, text });
    const categories = highlights.map((h) => h.category);

    expect(categories).toEqual(expect.arrayContaining(['subject.identity', 'subject.wardrobe', 'action.movement']));
    categories.forEach((category) => expect(VALID_CATEGORIES.has(category)).toBe(true));
  });

  it('maps legacy roles to taxonomy IDs', () => {
    const spans = [
      { text: 'walks', start: 32, end: 37, role: 'Movement' },
      { text: 'jacket', start: 24, end: 30, role: 'Wardrobe' },
    ];

    const highlights = convertLabeledSpansToHighlights({ spans, text });
    const categories = highlights.map((h) => h.category);

    expect(categories).toContain('action.movement');
    expect(categories).toContain('subject.wardrobe');
  });

  it('falls back to subject for unknown roles', () => {
    const spans = [{ text: 'something', start: 0, end: 9, role: 'NotReal' }];
    const [highlight] = convertLabeledSpansToHighlights({ spans, text });
    expect(highlight.category).toBe('subject');
  });
});
