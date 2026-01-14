import { describe, expect, it } from 'vitest';

import { isSubstringMatch, normalizeText, validateHighlightText } from '@features/span-highlighting/utils/textMatching';

describe('textMatching', () => {
  it('normalizes text by trimming, lowercasing, and collapsing whitespace', () => {
    expect(normalizeText('  Hello   WORLD ')).toBe('hello world');
  });

  it('detects substring matches', () => {
    expect(isSubstringMatch('close-up', 'close-up of')).toBe(true);
  });

  it('validates highlight text with normalization and substring matching', () => {
    expect(validateHighlightText('Close up', 'close   up', {}, 0, 0)).toBe(true);
    expect(validateHighlightText('Close-up', 'Close-up of subject', {}, 0, 0)).toBe(true);
    expect(validateHighlightText('Expected', '', {}, 0, 0)).toBe(false);
  });
});
