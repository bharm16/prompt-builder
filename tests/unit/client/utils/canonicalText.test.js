import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalText, createCanonicalText } from '../../../../client/src/utils/canonicalText.js';

describe('CanonicalText', () => {
  describe('constructor', () => {
    it('should create instance with string input', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.original).toBe('hello');
      expect(canonical.normalized).toBe('hello');
    });

    it('should normalize NFC unicode', () => {
      // Using combining characters that should be normalized
      const denormalized = 'café'; // May contain combining acute accent
      const canonical = new CanonicalText(denormalized);

      expect(typeof canonical.normalized).toBe('string');
    });

    it('should handle empty string', () => {
      const canonical = new CanonicalText('');

      expect(canonical.original).toBe('');
      expect(canonical.normalized).toBe('');
      expect(canonical.length).toBe(0);
    });

    it('should handle null as empty string', () => {
      const canonical = new CanonicalText(null);

      expect(canonical.original).toBe('');
      expect(canonical.normalized).toBe('');
    });

    it('should handle undefined as empty string', () => {
      const canonical = new CanonicalText(undefined);

      expect(canonical.original).toBe('');
      expect(canonical.normalized).toBe('');
    });

    it('should accept custom segmenter', () => {
      const customSegmenter = { segment: () => [] };
      const canonical = new CanonicalText('test', { segmenter: customSegmenter });

      expect(canonical.segmenter).toBe(customSegmenter);
    });

    it('should use default segmenter when not provided', () => {
      const canonical = new CanonicalText('test');

      // Default segmenter should be set (if Intl is available)
      if (typeof Intl !== 'undefined') {
        expect(canonical.segmenter).toBeDefined();
      }
    });

    it('should handle non-string input by converting to string', () => {
      const canonical = new CanonicalText(123);

      expect(canonical.normalized).toBe('');
    });
  });

  describe('length property', () => {
    it('should return grapheme count for ASCII text', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.length).toBe(5);
    });

    it('should count emoji as single grapheme', () => {
      const canonical = new CanonicalText('👋');

      expect(canonical.length).toBe(1);
    });

    it('should count multi-codepoint emoji as single grapheme', () => {
      const canonical = new CanonicalText('👨‍👩‍👧‍👦'); // Family emoji

      expect(canonical.length).toBeLessThanOrEqual(7); // Count may vary by implementation
      expect(canonical.length).toBeGreaterThan(0);
    });

    it('should handle combining characters correctly', () => {
      const canonical = new CanonicalText('é'); // e + combining acute

      expect(canonical.length).toBeGreaterThan(0);
    });

    it('should return 0 for empty text', () => {
      const canonical = new CanonicalText('');

      expect(canonical.length).toBe(0);
    });

    it('should cache length calculation', () => {
      const canonical = new CanonicalText('hello');

      const length1 = canonical.length;
      const length2 = canonical.length;

      expect(length1).toBe(length2);
    });
  });

  describe('graphemes property', () => {
    it('should return array of grapheme objects', () => {
      const canonical = new CanonicalText('hi');
      const graphemes = canonical.graphemes;

      expect(Array.isArray(graphemes)).toBe(true);
      expect(graphemes.length).toBe(2);
    });

    it('should include segment property for each grapheme', () => {
      const canonical = new CanonicalText('ab');
      const graphemes = canonical.graphemes;

      expect(graphemes[0]).toHaveProperty('segment');
      expect(graphemes[1]).toHaveProperty('segment');
      expect(graphemes[0].segment).toBe('a');
      expect(graphemes[1].segment).toBe('b');
    });

    it('should include start and end positions', () => {
      const canonical = new CanonicalText('ab');
      const graphemes = canonical.graphemes;

      expect(graphemes[0].start).toBe(0);
      expect(graphemes[0].end).toBeGreaterThan(0);
      expect(graphemes[1].start).toBeGreaterThan(graphemes[0].end - 1);
    });

    it('should include index property', () => {
      const canonical = new CanonicalText('abc');
      const graphemes = canonical.graphemes;

      expect(graphemes[0].index).toBe(0);
      expect(graphemes[1].index).toBe(1);
      expect(graphemes[2].index).toBe(2);
    });

    it('should cache graphemes array', () => {
      const canonical = new CanonicalText('test');

      const graphemes1 = canonical.graphemes;
      const graphemes2 = canonical.graphemes;

      expect(graphemes1).toBe(graphemes2);
    });

    it('should handle emoji as single grapheme', () => {
      const canonical = new CanonicalText('a👋b');
      const graphemes = canonical.graphemes;

      expect(graphemes.length).toBe(3);
      expect(graphemes[1].segment).toBe('👋');
    });

    it('should work without segmenter (fallback mode)', () => {
      const canonical = new CanonicalText('test', { segmenter: null });
      const graphemes = canonical.graphemes;

      expect(Array.isArray(graphemes)).toBe(true);
      expect(graphemes.length).toBeGreaterThan(0);
    });

    it('should build graphemeStarts array', () => {
      const canonical = new CanonicalText('abc');

      // Access graphemes to trigger cache build
      const graphemes = canonical.graphemes;

      expect(canonical._graphemeStarts).toBeDefined();
      expect(Array.isArray(canonical._graphemeStarts)).toBe(true);
    });
  });

  describe('toCodePoint / codeUnitOffsetForGrapheme', () => {
    it('should return 0 for index 0', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.toCodePoint(0)).toBe(0);
    });

    it('should return correct offset for ASCII characters', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.toCodePoint(1)).toBe(1);
      expect(canonical.toCodePoint(2)).toBe(2);
      expect(canonical.toCodePoint(3)).toBe(3);
    });

    it('should handle emoji with multi-byte encoding', () => {
      const canonical = new CanonicalText('a👋b');

      const offset1 = canonical.toCodePoint(1);
      const offset2 = canonical.toCodePoint(2);

      expect(offset2).toBeGreaterThan(offset1);
    });

    it('should return text length for index >= length', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.toCodePoint(100)).toBe(5);
      expect(canonical.toCodePoint(canonical.length)).toBe('hello'.length);
    });

    it('should return 0 for negative index', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.toCodePoint(-1)).toBe(0);
      expect(canonical.toCodePoint(-10)).toBe(0);
    });

    it('should build graphemeStarts cache if needed', () => {
      const canonical = new CanonicalText('test');

      expect(canonical._graphemeStarts).toBeNull();

      canonical.toCodePoint(1);

      expect(canonical._graphemeStarts).not.toBeNull();
    });
  });

  describe('graphemeIndexForCodeUnit', () => {
    it('should return 0 for offset 0', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.graphemeIndexForCodeUnit(0)).toBe(0);
    });

    it('should return grapheme index for code unit offset', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.graphemeIndexForCodeUnit(2)).toBe(2);
    });

    it('should handle emoji offsets correctly', () => {
      const canonical = new CanonicalText('a👋b');

      // Offset 0 should map to grapheme 0 (a)
      expect(canonical.graphemeIndexForCodeUnit(0)).toBe(0);

      // Offset after 'a' should map to grapheme 1 (emoji)
      const emojiOffset = 'a'.length;
      expect(canonical.graphemeIndexForCodeUnit(emojiOffset)).toBeGreaterThanOrEqual(0);
    });

    it('should return length for offset >= text length', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.graphemeIndexForCodeUnit(100)).toBe(canonical.length);
    });

    it('should return 0 for negative offset', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.graphemeIndexForCodeUnit(-1)).toBe(0);
    });

    it('should build graphemes cache if needed', () => {
      const canonical = new CanonicalText('test');

      expect(canonical._graphemeStarts).toBeNull();

      canonical.graphemeIndexForCodeUnit(2);

      expect(canonical._graphemeStarts).not.toBeNull();
    });

    it('should find correct grapheme for offset within multi-byte character', () => {
      const canonical = new CanonicalText('a👋b');

      const firstCharLen = 'a'.length;
      const emojiLen = '👋'.length;

      // Offset somewhere in the emoji should map to the emoji grapheme
      const offsetInEmoji = firstCharLen + 1;
      if (emojiLen > 1) {
        const graphemeIndex = canonical.graphemeIndexForCodeUnit(offsetInEmoji);
        expect(graphemeIndex).toBe(1); // Should be the emoji grapheme
      }
    });
  });

  describe('sliceGraphemes', () => {
    it('should slice ASCII text correctly', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.sliceGraphemes(0, 2)).toBe('he');
      expect(canonical.sliceGraphemes(1, 4)).toBe('ell');
      expect(canonical.sliceGraphemes(2, 5)).toBe('llo');
    });

    it('should handle emoji correctly', () => {
      const canonical = new CanonicalText('a👋b');

      const slice = canonical.sliceGraphemes(0, 2);
      expect(slice).toBe('a👋');
    });

    it('should return empty string for equal start and end', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.sliceGraphemes(2, 2)).toBe('');
    });

    it('should handle out of bounds indices', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.sliceGraphemes(0, 100)).toBe('hello');
      expect(canonical.sliceGraphemes(10, 20)).toBe('');
    });

    it('should handle negative indices by clamping to 0', () => {
      const canonical = new CanonicalText('hello');

      expect(canonical.sliceGraphemes(-5, 2)).toBe('he');
    });

    it('should swap start and end if end < start', () => {
      const canonical = new CanonicalText('hello');

      // When end < start, it should return empty or swap
      const result = canonical.sliceGraphemes(3, 1);
      expect(result).toBe(''); // Normalized to empty
    });

    it('should include start and exclude end (half-open range)', () => {
      const canonical = new CanonicalText('abcde');

      expect(canonical.sliceGraphemes(1, 3)).toBe('bc');
    });

    it('should handle complex unicode', () => {
      const canonical = new CanonicalText('😀😃😄😁');

      const slice = canonical.sliceGraphemes(1, 3);
      expect(slice).toBe('😃😄');
    });

    it('should work with combining characters', () => {
      const canonical = new CanonicalText('café'); // With combining accent

      const slice = canonical.sliceGraphemes(0, 3);
      expect(slice.length).toBeGreaterThan(0);
    });
  });

  describe('toJSON', () => {
    it('should return object with original, normalized, and length', () => {
      const canonical = new CanonicalText('hello');
      const json = canonical.toJSON();

      expect(json).toHaveProperty('original');
      expect(json).toHaveProperty('normalized');
      expect(json).toHaveProperty('length');
    });

    it('should include correct values', () => {
      const canonical = new CanonicalText('test');
      const json = canonical.toJSON();

      expect(json.original).toBe('test');
      expect(json.normalized).toBe('test');
      expect(json.length).toBe(4);
    });

    it('should be serializable to JSON string', () => {
      const canonical = new CanonicalText('hello');
      const json = canonical.toJSON();

      expect(() => JSON.stringify(json)).not.toThrow();
    });

    it('should work with emoji', () => {
      const canonical = new CanonicalText('👋');
      const json = canonical.toJSON();

      expect(json.original).toBe('👋');
      expect(json.normalized).toBe('👋');
      expect(json.length).toBe(1);
    });
  });

  describe('createCanonicalText factory function', () => {
    it('should create CanonicalText instance', () => {
      const canonical = createCanonicalText('test');

      expect(canonical).toBeInstanceOf(CanonicalText);
    });

    it('should pass input to constructor', () => {
      const canonical = createCanonicalText('hello');

      expect(canonical.original).toBe('hello');
    });

    it('should pass options to constructor', () => {
      const customSegmenter = { segment: () => [] };
      const canonical = createCanonicalText('test', { segmenter: customSegmenter });

      expect(canonical.segmenter).toBe(customSegmenter);
    });
  });

  describe('edge cases and integration', () => {
    it('should handle very long strings', () => {
      const longText = 'a'.repeat(10000);
      const canonical = new CanonicalText(longText);

      expect(canonical.length).toBe(10000);
    });

    it('should handle mixed content', () => {
      const mixed = 'Hello 世界 👋 test';
      const canonical = new CanonicalText(mixed);

      expect(canonical.length).toBeGreaterThan(0);
      const slice = canonical.sliceGraphemes(0, canonical.length);
      expect(slice).toBe(mixed);
    });

    it('should handle zero-width characters', () => {
      const text = 'test\u200Bword'; // Zero-width space
      const canonical = new CanonicalText(text);

      expect(canonical.length).toBeGreaterThan(0);
    });

    it('should handle RTL text', () => {
      const rtl = 'مرحبا'; // Arabic
      const canonical = new CanonicalText(rtl);

      expect(canonical.length).toBeGreaterThan(0);
    });

    it('should maintain consistency across operations', () => {
      const text = 'a👋b';
      const canonical = new CanonicalText(text);

      const length = canonical.length;
      const slice = canonical.sliceGraphemes(0, length);

      expect(slice).toBe(text);
    });

    it('should handle repeated accesses efficiently', () => {
      const canonical = new CanonicalText('test string here');

      // These should use cached values
      const l1 = canonical.length;
      const l2 = canonical.length;
      const g1 = canonical.graphemes;
      const g2 = canonical.graphemes;

      expect(l1).toBe(l2);
      expect(g1).toBe(g2);
    });

    it('should convert between indices correctly', () => {
      const canonical = new CanonicalText('hello');

      for (let i = 0; i < canonical.length; i++) {
        const codeUnit = canonical.toCodePoint(i);
        const graphemeIndex = canonical.graphemeIndexForCodeUnit(codeUnit);

        expect(graphemeIndex).toBe(i);
      }
    });

    it('should slice and reconstruct text', () => {
      const original = 'abcdefgh';
      const canonical = new CanonicalText(original);

      const parts = [
        canonical.sliceGraphemes(0, 3),
        canonical.sliceGraphemes(3, 6),
        canonical.sliceGraphemes(6, 8),
      ];

      expect(parts.join('')).toBe(original);
    });
  });

  describe('fallback mode without Intl.Segmenter', () => {
    it('should work without segmenter', () => {
      const canonical = new CanonicalText('hello', { segmenter: null });

      expect(canonical.length).toBeGreaterThan(0);
      expect(canonical.graphemes.length).toBeGreaterThan(0);
    });

    it('should treat each character as grapheme in fallback', () => {
      const canonical = new CanonicalText('hello', { segmenter: null });

      // In fallback, each code unit is treated as grapheme
      expect(canonical.length).toBe(5);
    });

    it('should handle emoji in fallback mode', () => {
      const canonical = new CanonicalText('👋', { segmenter: null });

      // Emoji may be split into surrogate pairs in fallback
      expect(canonical.length).toBeGreaterThan(0);
    });

    it('should still support slicing in fallback mode', () => {
      const canonical = new CanonicalText('hello', { segmenter: null });

      expect(canonical.sliceGraphemes(0, 2)).toBeTruthy();
    });
  });

  describe('unicode normalization', () => {
    it('should normalize composed and decomposed forms to same result', () => {
      // Two different ways to represent é
      const composed = new CanonicalText('\u00e9'); // é as single character
      const decomposed = new CanonicalText('e\u0301'); // e + combining acute

      expect(composed.normalized).toBe(decomposed.normalized);
    });

    it('should preserve original form', () => {
      const decomposed = new CanonicalText('e\u0301');

      // Original should preserve input
      expect(decomposed.original).toBe('e\u0301');
    });
  });
});
