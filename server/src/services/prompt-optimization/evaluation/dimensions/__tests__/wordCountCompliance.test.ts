import { describe, it, expect } from 'vitest';
import { evaluateWordCountCompliance } from '../wordCountCompliance';

const generateWords = (count: number): string =>
  Array.from({ length: count }, (_, i) => `word${i}`).join(' ');

describe('evaluateWordCountCompliance', () => {
  describe('boundary values', () => {
    it('returns 0.2 for very short prompt (< 30 words)', () => {
      expect(evaluateWordCountCompliance(generateWords(10))).toBe(0.2);
    });

    it('returns 0.5 at exactly 30 words (lower boundary of 30-200 range)', () => {
      expect(evaluateWordCountCompliance(generateWords(30))).toBe(0.5);
    });

    it('returns 0.8 at exactly 50 words (lower boundary of 50-150 range)', () => {
      expect(evaluateWordCountCompliance(generateWords(50))).toBe(0.8);
    });

    it('returns 1.0 at exactly 75 words (lower boundary of ideal range)', () => {
      expect(evaluateWordCountCompliance(generateWords(75))).toBe(1.0);
    });

    it('returns 1.0 at 100 words (middle of ideal range)', () => {
      expect(evaluateWordCountCompliance(generateWords(100))).toBe(1.0);
    });

    it('returns 1.0 at exactly 125 words (upper boundary of ideal range)', () => {
      expect(evaluateWordCountCompliance(generateWords(125))).toBe(1.0);
    });

    it('returns 0.8 at exactly 150 words (upper boundary of 50-150 range)', () => {
      expect(evaluateWordCountCompliance(generateWords(150))).toBe(0.8);
    });

    it('returns 0.5 at exactly 200 words (upper boundary of 30-200 range)', () => {
      expect(evaluateWordCountCompliance(generateWords(200))).toBe(0.5);
    });

    it('returns 0.2 for very long prompt (> 200 words)', () => {
      expect(evaluateWordCountCompliance(generateWords(250))).toBe(0.2);
    });
  });

  describe('edge cases', () => {
    it('returns 0.2 for empty string', () => {
      expect(evaluateWordCountCompliance('')).toBe(0.2);
    });

    it('handles JSON-wrapped prompt via extractMainVideoPrompt', () => {
      const words = generateWords(100);
      const jsonPrompt = `{"prompt": "${words}"}`;
      expect(evaluateWordCountCompliance(jsonPrompt)).toBe(1.0);
    });
  });

  describe('score transitions', () => {
    it('returns different scores for 29 vs 30 words', () => {
      expect(evaluateWordCountCompliance(generateWords(29))).toBe(0.2);
      expect(evaluateWordCountCompliance(generateWords(30))).toBe(0.5);
    });

    it('returns different scores for 49 vs 50 words', () => {
      expect(evaluateWordCountCompliance(generateWords(49))).toBe(0.5);
      expect(evaluateWordCountCompliance(generateWords(50))).toBe(0.8);
    });

    it('returns different scores for 126 vs 125 words', () => {
      expect(evaluateWordCountCompliance(generateWords(125))).toBe(1.0);
      expect(evaluateWordCountCompliance(generateWords(126))).toBe(0.8);
    });
  });
});
