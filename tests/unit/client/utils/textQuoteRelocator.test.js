import { describe, it, expect } from 'vitest';
import { relocateQuote } from '../../../../client/src/utils/textQuoteRelocator.js';

describe('textQuoteRelocator', () => {
  describe('relocateQuote', () => {
    describe('basic functionality', () => {
      it('should return null when text is empty', () => {
        const result = relocateQuote({ text: '', quote: 'test' });
        expect(result).toBeNull();
      });

      it('should return null when text is null', () => {
        const result = relocateQuote({ text: null, quote: 'test' });
        expect(result).toBeNull();
      });

      it('should return null when text is undefined', () => {
        const result = relocateQuote({ text: undefined, quote: 'test' });
        expect(result).toBeNull();
      });

      it('should return null when quote is empty', () => {
        const result = relocateQuote({ text: 'some text', quote: '' });
        expect(result).toBeNull();
      });

      it('should return null when quote is null', () => {
        const result = relocateQuote({ text: 'some text', quote: null });
        expect(result).toBeNull();
      });

      it('should return null when quote is not found', () => {
        const result = relocateQuote({ text: 'hello world', quote: 'missing' });
        expect(result).toBeNull();
      });
    });

    describe('single match scenarios', () => {
      it('should find single match and return start/end positions', () => {
        const text = 'hello world test';
        const quote = 'world';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 6, end: 11 });
      });

      it('should find match at beginning of text', () => {
        const text = 'hello world';
        const quote = 'hello';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 0, end: 5 });
      });

      it('should find match at end of text', () => {
        const text = 'hello world';
        const quote = 'world';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 6, end: 11 });
      });

      it('should handle quote equal to entire text', () => {
        const text = 'hello';
        const quote = 'hello';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 0, end: 5 });
      });

      it('should be case-sensitive', () => {
        const text = 'Hello world';
        const quote = 'hello';

        const result = relocateQuote({ text, quote });

        expect(result).toBeNull();
      });

      it('should find exact match including whitespace', () => {
        const text = 'hello  world'; // Two spaces
        const quote = 'hello  world';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 0, end: 12 });
      });
    });

    describe('multiple match scenarios', () => {
      it('should find best match among multiple occurrences using context', () => {
        const text = 'test one test two test three';
        const quote = 'test';
        const leftCtx = 'two ';
        const rightCtx = ' three';

        const result = relocateQuote({ text, quote, leftCtx, rightCtx });

        expect(result.start).toBe(18); // Third occurrence
        expect(result.end).toBe(22);
      });

      it('should use left context to disambiguate', () => {
        const text = 'apple banana apple cherry apple';
        const quote = 'apple';
        const leftCtx = 'banana ';

        const result = relocateQuote({ text, quote, leftCtx });

        expect(result.start).toBe(13); // Second occurrence
      });

      it('should use right context to disambiguate', () => {
        const text = 'apple banana apple cherry apple';
        const quote = 'apple';
        const rightCtx = ' cherry';

        const result = relocateQuote({ text, quote, rightCtx });

        expect(result.start).toBe(13); // Second occurrence
      });

      it('should combine left and right context scores', () => {
        const text = 'test before test target test after';
        const quote = 'test';
        const leftCtx = 'before ';
        const rightCtx = ' target';

        const result = relocateQuote({ text, quote, leftCtx, rightCtx });

        expect(result.start).toBe(12); // Middle occurrence with both contexts
      });

      it('should return first match when contexts are identical', () => {
        const text = 'test abc test abc test abc';
        const quote = 'test';
        const rightCtx = ' abc';

        const result = relocateQuote({ text, quote, rightCtx });

        // All have same right context, should pick first or best score
        expect(result.start).toBeGreaterThanOrEqual(0);
        expect(result.end - result.start).toBe(4);
      });

      it('should handle many occurrences efficiently', () => {
        const text = Array.from({ length: 100 }, () => 'test').join(' ');
        const quote = 'test';
        const leftCtx = '';
        const rightCtx = '';

        const result = relocateQuote({ text, quote, leftCtx, rightCtx });

        expect(result).not.toBeNull();
        expect(result.start).toBe(0); // First occurrence when no context
      });
    });

    describe('context scoring', () => {
      it('should prefer match with better left context', () => {
        const text = 'abc target xyz target';
        const quote = 'target';
        const leftCtx = 'abc ';

        const result = relocateQuote({ text, quote, leftCtx });

        expect(result.start).toBe(4); // First occurrence
      });

      it('should prefer match with better right context', () => {
        const text = 'target abc target xyz';
        const quote = 'target';
        const rightCtx = ' xyz';

        const result = relocateQuote({ text, quote, rightCtx });

        expect(result.start).toBe(11); // Second occurrence
      });

      it('should handle partial context matches', () => {
        const text = 'prefix target suffix target';
        const quote = 'target';
        const leftCtx = 'pre'; // Only partial match with 'prefix'

        const result = relocateQuote({ text, quote, leftCtx });

        // Should still prefer first match due to partial match
        expect(result.start).toBe(7);
      });

      it('should handle context longer than available text', () => {
        const text = 'ab target cd';
        const quote = 'target';
        const leftCtx = 'a'.repeat(100);
        const rightCtx = 'c'.repeat(100);

        const result = relocateQuote({ text, quote, leftCtx, rightCtx });

        expect(result).not.toBeNull();
      });

      it('should award points for matching context characters', () => {
        const text = 'same prefix target different prefix target';
        const quote = 'target';
        const leftCtx = 'same prefix ';

        const result = relocateQuote({ text, quote, leftCtx });

        expect(result.start).toBe(12); // First 'target' has matching left context
      });
    });

    describe('preferIndex parameter', () => {
      it('should prefer matches closer to preferIndex when scores tie', () => {
        const text = 'test one test two test three';
        const quote = 'test';
        const preferIndex = 13; // Close to second 'test'

        const result = relocateQuote({ text, quote, preferIndex });

        expect(result.start).toBe(9); // Second occurrence
      });

      it('should still prioritize context over preferIndex', () => {
        const text = 'test A test B test C';
        const quote = 'test';
        const preferIndex = 0; // Prefers first
        const rightCtx = ' C'; // But context strongly indicates third

        const result = relocateQuote({ text, quote, preferIndex, rightCtx });

        // Context should override preferIndex
        expect(result.start).toBe(14); // Third occurrence
      });

      it('should break ties using preferIndex', () => {
        const text = 'test test test';
        const quote = 'test';
        const preferIndex = 10; // Closer to third

        const result = relocateQuote({ text, quote, preferIndex });

        expect(result.start).toBe(10); // Third occurrence
      });

      it('should work with preferIndex of 0', () => {
        const text = 'test test test';
        const quote = 'test';
        const preferIndex = 0;

        const result = relocateQuote({ text, quote, preferIndex });

        expect(result.start).toBe(0); // First occurrence
      });

      it('should reduce score slightly based on distance from preferIndex', () => {
        const text = 'test at 0, test at 11, test at 23';
        const quote = 'test';
        const preferIndex = 11; // Exactly at second occurrence

        const result = relocateQuote({ text, quote, preferIndex });

        expect(result.start).toBe(11); // Second occurrence
      });
    });

    describe('edge cases', () => {
      it('should handle single character quotes', () => {
        const text = 'a b c d';
        const quote = 'c';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 4, end: 5 });
      });

      it('should handle unicode characters', () => {
        const text = 'Hello 世界 test 世界 end';
        const quote = '世界';

        const result = relocateQuote({ text, quote });

        expect(result.start).toBe(6);
        expect(result.end).toBe(8);
      });

      it('should handle emoji', () => {
        const text = 'start 🎬 middle 🎬 end';
        const quote = '🎬';

        const result = relocateQuote({ text, quote });

        expect(result).not.toBeNull();
        expect(text.slice(result.start, result.end)).toBe('🎬');
      });

      it('should handle special regex characters in quote', () => {
        const text = 'test (special) text';
        const quote = '(special)';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 5, end: 14 });
      });

      it('should handle newlines and tabs', () => {
        const text = 'line1\nline2\ttest';
        const quote = 'test';

        const result = relocateQuote({ text, quote });

        expect(result).toEqual({ start: 12, end: 16 });
      });

      it('should handle very long text', () => {
        const longText = 'a'.repeat(10000) + 'target' + 'b'.repeat(10000);
        const quote = 'target';

        const result = relocateQuote({ text: longText, quote });

        expect(result).toEqual({ start: 10000, end: 10006 });
      });

      it('should handle quote appearing many times', () => {
        const text = 'a '.repeat(1000) + 'target ' + 'a '.repeat(1000);
        const quote = 'a';
        const rightCtx = ' target';

        // Should find the 'a' before 'target'
        const result = relocateQuote({ text, quote, rightCtx });

        expect(result).not.toBeNull();
        // The 'a' before 'target' should be preferred
      });

      it('should handle overlapping potential matches', () => {
        const text = 'aaaa';
        const quote = 'aa';

        const result = relocateQuote({ text, quote });

        // Should find first occurrence
        expect(result).toEqual({ start: 0, end: 2 });
      });
    });

    describe('context boundaries', () => {
      it('should only check context within 80 characters', () => {
        // Create text where match is far from context
        const prefix = 'x'.repeat(200);
        const text = prefix + 'target';
        const quote = 'target';
        const leftCtx = 'y'.repeat(100); // Doesn't match, but is far enough not to matter

        const result = relocateQuote({ text, quote, leftCtx });

        expect(result).not.toBeNull(); // Should still find match
      });

      it('should compare context character by character', () => {
        const text = 'abc target def target';
        const quote = 'target';
        const leftCtx = 'abc ';

        const result = relocateQuote({ text, quote, leftCtx });

        // 'abc ' matches exactly before first target
        expect(result.start).toBe(4);
      });

      it('should stop scoring when characters differ', () => {
        const text = 'prefix target different target';
        const quote = 'target';
        const leftCtx = 'prefix ';

        const result = relocateQuote({ text, quote, leftCtx });

        // 'prefix ' fully matches before first target (6 chars match)
        // 'different ' before second target matches 0 chars
        expect(result.start).toBe(7);
      });
    });

    describe('return value format', () => {
      it('should always return object with start and end properties', () => {
        const text = 'find this';
        const quote = 'this';

        const result = relocateQuote({ text, quote });

        expect(result).toHaveProperty('start');
        expect(result).toHaveProperty('end');
        expect(typeof result.start).toBe('number');
        expect(typeof result.end).toBe('number');
      });

      it('should have end equal to start + quote length', () => {
        const text = 'test string here';
        const quote = 'string';

        const result = relocateQuote({ text, quote });

        expect(result.end - result.start).toBe(quote.length);
      });

      it('should allow extracting quote using start and end', () => {
        const text = 'extract this phrase from text';
        const quote = 'this phrase';

        const result = relocateQuote({ text, quote });

        const extracted = text.slice(result.start, result.end);
        expect(extracted).toBe(quote);
      });
    });

    describe('real-world scenarios', () => {
      it('should relocate quote in edited document', () => {
        // Simulating a quote that moved because text was added before it
        const originalText = 'The quick brown fox jumps';
        const editedText = 'ADDED TEXT HERE. The quick brown fox jumps';
        const quote = 'quick brown fox';
        const leftCtx = 'The ';
        const rightCtx = ' jumps';

        const result = relocateQuote({
          text: editedText,
          quote,
          leftCtx,
          rightCtx
        });

        expect(result.start).toBe(21);
        expect(editedText.slice(result.start, result.end)).toBe(quote);
      });

      it('should find quote in code with similar patterns', () => {
        const code = 'function test() { return test; } const test = 5;';
        const quote = 'test';
        const leftCtx = 'const ';
        const rightCtx = ' =';

      const result = relocateQuote({ text: code, quote, leftCtx, rightCtx });

        expect(result.start).toBe(39); // The 'test' in 'const test'
      });

      it('should relocate highlighted text in prose', () => {
        const prose = 'The cinematographer adjusted the camera. The camera angle was perfect. Focus on the camera lens.';
        const quote = 'camera';
        const leftCtx = 'the ';
        const rightCtx = ' lens';

      const result = relocateQuote({ text: prose, quote, leftCtx, rightCtx });

        // Should find 'camera' before 'lens'
        expect(result.start).toBe(84);
      });

      it('should handle repeated technical terms', () => {
        const technical = '24fps for cinematic, 30fps for standard, 60fps for action';
        const quote = 'fps';
        const leftCtx = '30';
        const rightCtx = ' for standard';

      const result = relocateQuote({ text: technical, quote, leftCtx, rightCtx });

        expect(result.start).toBe(23); // Second 'fps'
      });
    });

    describe('performance', () => {
      it('should handle large text with many matches efficiently', () => {
        const pattern = 'word ';
        const text = pattern.repeat(10000) + 'target';
        const quote = 'word';
        const startTime = Date.now();

        const result = relocateQuote({ text, quote });

        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(100); // Should be fast
        expect(result).not.toBeNull();
      });
    });
  });
});
