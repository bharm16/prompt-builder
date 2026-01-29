import { describe, it, expect } from 'vitest';
import { countWords, isSentence, normalizeText } from '../textHelpers';

describe('countWords', () => {
  describe('edge cases', () => {
    it('returns 0 for null', () => {
      expect(countWords(null)).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(countWords(undefined)).toBe(0);
    });

    it('returns 0 for empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('returns 0 for whitespace-only string', () => {
      expect(countWords('   \t\n  ')).toBe(0);
    });

    it('returns 0 for non-string input', () => {
      expect(countWords(42 as unknown as string)).toBe(0);
    });
  });

  describe('core behavior', () => {
    it('counts single word', () => {
      expect(countWords('hello')).toBe(1);
    });

    it('counts multiple words separated by spaces', () => {
      expect(countWords('one two three')).toBe(3);
    });

    it('handles extra whitespace between words', () => {
      expect(countWords('  one   two   three  ')).toBe(3);
    });

    it('handles tabs and newlines', () => {
      expect(countWords('one\ttwo\nthree')).toBe(3);
    });
  });
});

describe('isSentence', () => {
  describe('edge cases', () => {
    it('returns false for null', () => {
      expect(isSentence(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isSentence(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSentence('')).toBe(false);
    });
  });

  describe('punctuation detection', () => {
    it('returns true for text ending with period', () => {
      expect(isSentence('Hello world.')).toBe(true);
    });

    it('returns true for text ending with exclamation mark', () => {
      expect(isSentence('Hello world!')).toBe(true);
    });

    it('returns true for text ending with question mark', () => {
      expect(isSentence('Hello world?')).toBe(true);
    });

    it('returns false for short text without ending punctuation', () => {
      expect(isSentence('Hello')).toBe(false);
    });
  });

  describe('word count threshold', () => {
    it('returns true for 12+ words without punctuation', () => {
      const text = 'one two three four five six seven eight nine ten eleven twelve';
      expect(isSentence(text)).toBe(true);
    });

    it('returns false for 11 words without punctuation', () => {
      const text = 'one two three four five six seven eight nine ten eleven';
      expect(isSentence(text)).toBe(false);
    });
  });

  describe('pre-computed word count', () => {
    it('uses provided wordCount instead of computing', () => {
      // Short text but high wordCount passed in → true
      expect(isSentence('short', 12)).toBe(true);
    });

    it('respects low provided wordCount', () => {
      // No punctuation, low wordCount → false
      expect(isSentence('short text here', 3)).toBe(false);
    });
  });
});

describe('normalizeText', () => {
  describe('edge cases', () => {
    it('returns empty string for null', () => {
      expect(normalizeText(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(normalizeText(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('core behavior', () => {
    it('lowercases text', () => {
      expect(normalizeText('Hello WORLD')).toBe('hello world');
    });

    it('preserves whitespace (only lowercases)', () => {
      expect(normalizeText('  Hello  ')).toBe('  hello  ');
    });
  });
});
