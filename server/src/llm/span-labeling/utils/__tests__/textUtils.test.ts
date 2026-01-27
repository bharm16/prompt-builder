import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  clamp01,
  wordCount,
  matchesAtIndices,
  buildSpanKey,
  formatValidationErrors,
} from '../textUtils';
import { DEFAULT_CONFIDENCE } from '../../config/SpanLabelingConfig';

describe('clamp01', () => {
  describe('error handling', () => {
    it('returns DEFAULT_CONFIDENCE for null', () => {
      const result = clamp01(null);
      expect(result).toBe(DEFAULT_CONFIDENCE);
    });

    it('returns DEFAULT_CONFIDENCE for undefined', () => {
      const result = clamp01(undefined);
      expect(result).toBe(DEFAULT_CONFIDENCE);
    });

    it('returns DEFAULT_CONFIDENCE for string', () => {
      const result = clamp01('0.5');
      expect(result).toBe(DEFAULT_CONFIDENCE);
    });

    it('returns NaN for NaN input (typeof NaN === "number")', () => {
      // NaN is typeof 'number' in JavaScript, so it passes the type check
      // but Math.min/max with NaN returns NaN
      const result = clamp01(NaN);
      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns DEFAULT_CONFIDENCE for object', () => {
      const result = clamp01({ value: 0.5 });
      expect(result).toBe(DEFAULT_CONFIDENCE);
    });

    it('returns DEFAULT_CONFIDENCE for array', () => {
      const result = clamp01([0.5]);
      expect(result).toBe(DEFAULT_CONFIDENCE);
    });
  });

  describe('edge cases', () => {
    it('clamps values above 1 to exactly 1', () => {
      expect(clamp01(1.5)).toBe(1);
      expect(clamp01(100)).toBe(1);
      expect(clamp01(Infinity)).toBe(1);
    });

    it('clamps values below 0 to exactly 0', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(-100)).toBe(0);
      expect(clamp01(-Infinity)).toBe(0);
    });

    it('preserves boundary value 0', () => {
      expect(clamp01(0)).toBe(0);
    });

    it('preserves boundary value 1', () => {
      expect(clamp01(1)).toBe(1);
    });
  });

  describe('core behavior', () => {
    it('preserves values between 0 and 1', () => {
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(0.25)).toBe(0.25);
      expect(clamp01(0.75)).toBe(0.75);
    });
  });

  describe('invariants', () => {
    it('always returns a number between 0 and 1 for numeric input', () => {
      fc.assert(
        fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (num) => {
          const result = clamp01(num);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        })
      );
    });

    it('never changes values already within [0, 1]', () => {
      fc.assert(
        fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (num) => {
          expect(clamp01(num)).toBe(num);
        })
      );
    });
  });
});

describe('wordCount', () => {
  describe('error handling', () => {
    it('returns 0 for null', () => {
      expect(wordCount(null)).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(wordCount(undefined)).toBe(0);
    });

    it('returns 0 for empty string', () => {
      expect(wordCount('')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('counts single word', () => {
      expect(wordCount('hello')).toBe(1);
    });

    it('handles multiple spaces between words', () => {
      expect(wordCount('hello    world')).toBe(2);
    });

    it('handles leading and trailing whitespace', () => {
      expect(wordCount('  hello world  ')).toBe(2);
    });

    it('counts hyphenated words as single word', () => {
      expect(wordCount('state-of-the-art')).toBe(1);
    });

    it('counts contractions as single word', () => {
      expect(wordCount("don't"  )).toBe(1);
    });

    it('handles tabs and newlines as whitespace', () => {
      expect(wordCount('hello\tworld\nnew')).toBe(3);
    });

    it('handles Unicode letters', () => {
      expect(wordCount('café résumé naïve')).toBe(3);
    });

    it('handles ASCII numbers with word boundaries', () => {
      // Full-width numbers (４５６) and CJK numerals (七八九) don't match \b word boundaries
      // Only ASCII numbers with proper word boundaries are counted
      expect(wordCount('123 456 789')).toBe(3);
    });

    it('counts numbers as words', () => {
      expect(wordCount('hello 123 world')).toBe(3);
    });

    it('handles punctuation between words', () => {
      expect(wordCount('hello, world!')).toBe(2);
    });

    it('handles only whitespace', () => {
      expect(wordCount('   \t\n   ')).toBe(0);
    });
  });

  describe('core behavior', () => {
    it('counts space-separated words', () => {
      expect(wordCount('one two three four five')).toBe(5);
    });
  });

  describe('invariants', () => {
    it('always returns non-negative integer', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const count = wordCount(str);
          expect(Number.isInteger(count)).toBe(true);
          expect(count).toBeGreaterThanOrEqual(0);
        })
      );
    });
  });
});

describe('matchesAtIndices', () => {
  describe('error handling', () => {
    it('returns false when indices are out of bounds', () => {
      const result = matchesAtIndices('hello', { start: 10, end: 15, text: 'world' });
      expect(result).toBe(false);
    });

    it('returns true when end exceeds text length but text matches (slice is tolerant)', () => {
      // JavaScript slice(0, 100) on 'hello' returns 'hello' - no bounds error
      const result = matchesAtIndices('hello', { start: 0, end: 100, text: 'hello' });
      expect(result).toBe(true);
    });

    it('returns false when start is negative', () => {
      const result = matchesAtIndices('hello', { start: -1, end: 4, text: 'hell' });
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns true for empty span at position 0', () => {
      const result = matchesAtIndices('hello', { start: 0, end: 0, text: '' });
      expect(result).toBe(true);
    });

    it('returns true for empty span at end of text', () => {
      const result = matchesAtIndices('hello', { start: 5, end: 5, text: '' });
      expect(result).toBe(true);
    });

    it('returns true for entire text as span', () => {
      const result = matchesAtIndices('hello', { start: 0, end: 5, text: 'hello' });
      expect(result).toBe(true);
    });

    it('returns false when text differs by case', () => {
      const result = matchesAtIndices('Hello', { start: 0, end: 5, text: 'hello' });
      expect(result).toBe(false);
    });

    it('handles Unicode characters correctly', () => {
      const text = 'café world';
      const result = matchesAtIndices(text, { start: 0, end: 4, text: 'café' });
      expect(result).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('returns true when span text matches at exact indices', () => {
      const text = 'hello world';
      const result = matchesAtIndices(text, { start: 6, end: 11, text: 'world' });
      expect(result).toBe(true);
    });

    it('returns false when span text differs from indices', () => {
      const text = 'hello world';
      const result = matchesAtIndices(text, { start: 6, end: 11, text: 'earth' });
      expect(result).toBe(false);
    });

    it('returns false when indices capture wrong portion', () => {
      const text = 'hello world';
      const result = matchesAtIndices(text, { start: 0, end: 5, text: 'world' });
      expect(result).toBe(false);
    });
  });
});

describe('buildSpanKey', () => {
  describe('edge cases', () => {
    it('handles zero indices', () => {
      const result = buildSpanKey({ start: 0, end: 0, text: '' });
      expect(result).toBe('0|0|');
    });

    it('handles special characters in text', () => {
      const result = buildSpanKey({ start: 5, end: 10, text: 'a|b|c' });
      expect(result).toBe('5|10|a|b|c');
    });

    it('handles newlines in text', () => {
      const result = buildSpanKey({ start: 0, end: 5, text: 'a\nb' });
      expect(result).toBe('0|5|a\nb');
    });

    it('handles Unicode text', () => {
      const result = buildSpanKey({ start: 0, end: 4, text: 'café' });
      expect(result).toBe('0|4|café');
    });
  });

  describe('core behavior', () => {
    it('creates unique key from start, end, and text', () => {
      const result = buildSpanKey({ start: 10, end: 20, text: 'hello world' });
      expect(result).toBe('10|20|hello world');
    });

    it('creates different keys for different start positions', () => {
      const key1 = buildSpanKey({ start: 0, end: 5, text: 'hello' });
      const key2 = buildSpanKey({ start: 10, end: 15, text: 'hello' });
      expect(key1).not.toBe(key2);
    });

    it('creates different keys for different end positions', () => {
      const key1 = buildSpanKey({ start: 0, end: 5, text: 'hello' });
      const key2 = buildSpanKey({ start: 0, end: 10, text: 'hello' });
      expect(key1).not.toBe(key2);
    });

    it('creates different keys for different text', () => {
      const key1 = buildSpanKey({ start: 0, end: 5, text: 'hello' });
      const key2 = buildSpanKey({ start: 0, end: 5, text: 'world' });
      expect(key1).not.toBe(key2);
    });
  });

  describe('invariants', () => {
    it('always produces consistent keys for same input', () => {
      fc.assert(
        fc.property(
          fc.nat(1000),
          fc.nat(1000),
          fc.string({ maxLength: 100 }),
          (start, endDelta, text) => {
            const span = { start, end: start + endDelta, text };
            const key1 = buildSpanKey(span);
            const key2 = buildSpanKey(span);
            expect(key1).toBe(key2);
          }
        )
      );
    });
  });
});

describe('formatValidationErrors', () => {
  describe('edge cases', () => {
    it('returns empty string for empty array', () => {
      const result = formatValidationErrors([]);
      expect(result).toBe('');
    });

    it('handles single error', () => {
      const result = formatValidationErrors(['Error one']);
      expect(result).toBe('1. Error one');
    });

    it('handles errors with special characters', () => {
      const result = formatValidationErrors(['Error: "invalid"', "Don't do that"]);
      expect(result).toBe('1. Error: "invalid"\n2. Don\'t do that');
    });
  });

  describe('core behavior', () => {
    it('numbers errors starting from 1', () => {
      const result = formatValidationErrors(['First', 'Second', 'Third']);
      expect(result).toBe('1. First\n2. Second\n3. Third');
    });

    it('joins errors with newlines', () => {
      const errors = ['Error A', 'Error B'];
      const result = formatValidationErrors(errors);
      expect(result).toContain('\n');
      expect(result.split('\n')).toHaveLength(2);
    });
  });

  describe('invariants', () => {
    it('produces N lines for N errors', () => {
      fc.assert(
        fc.property(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }), (errors) => {
          const result = formatValidationErrors(errors);
          const lines = result.split('\n');
          expect(lines).toHaveLength(errors.length);
        })
      );
    });

    it('each line starts with correct number', () => {
      fc.assert(
        fc.property(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }), (errors) => {
          const result = formatValidationErrors(errors);
          const lines = result.split('\n');
          lines.forEach((line, idx) => {
            expect(line.startsWith(`${idx + 1}. `)).toBe(true);
          });
        })
      );
    });
  });
});
