import { describe, it, expect } from 'vitest';

import { relocateQuote } from '@/utils/textQuoteRelocator';

describe('textQuoteRelocator', () => {
  describe('error handling', () => {
    it('returns null when text or quote is missing', () => {
      expect(relocateQuote({ text: '', quote: 'quote' })).toBeNull();
      expect(relocateQuote({ text: 'text', quote: '' })).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('matches quotes with variable whitespace', () => {
      const result = relocateQuote({
        text: 'hello   world',
        quote: 'hello world',
      });

      expect(result?.start).toBe(0);
      expect(result?.exact).toBe(false);
    });

    it('prefers the match closest to the preferred index', () => {
      const text = 'alpha quick brown fox beta quick brown fox';
      const quote = 'quick brown fox';
      const secondStart = text.lastIndexOf(quote);

      const result = relocateQuote({
        text,
        quote,
        preferIndex: secondStart,
      });

      expect(result?.start).toBe(secondStart);
    });
  });

  describe('core behavior', () => {
    it('uses context tokens to choose the best match', () => {
      const text = 'alpha quick brown fox jumps beta quick brown fox sleeps';
      const quote = 'quick brown fox';
      const expectedStart = text.lastIndexOf(quote);

      const result = relocateQuote({
        text,
        quote,
        leftCtx: 'beta',
        rightCtx: 'sleeps',
      });

      expect(result?.start).toBe(expectedStart);
    });
  });
});
