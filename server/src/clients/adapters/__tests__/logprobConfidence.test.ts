import { describe, it, expect } from 'vitest';
import { calculateConfidenceFromLogprobs } from '../logprobConfidence';

describe('calculateConfidenceFromLogprobs', () => {
  describe('error handling', () => {
    it('returns zeros for empty input', () => {
      const result = calculateConfidenceFromLogprobs([]);

      expect(result).toEqual({
        average: 0,
        min: 0,
        max: 0,
        lowConfidenceTokens: 0,
      });
    });

    it('returns zeros for undefined input', () => {
      const result = calculateConfidenceFromLogprobs(undefined as unknown as Array<{ logprob: number }>);

      expect(result).toEqual({
        average: 0,
        min: 0,
        max: 0,
        lowConfidenceTokens: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('uses provided probabilities instead of exponentiating logprobs', () => {
      const result = calculateConfidenceFromLogprobs([
        { logprob: Math.log(0.9) },
        { logprob: Math.log(0.2) },
        { logprob: -1, probability: 0.8 },
      ]);

      expect(result.min).toBeCloseTo(0.2, 5);
      expect(result.max).toBeCloseTo(0.9, 5);
      expect(result.average).toBeCloseTo(0.6333333, 5);
      expect(result.lowConfidenceTokens).toBe(1);
    });
  });

  describe('core behavior', () => {
    it('computes statistics from logprob values', () => {
      const result = calculateConfidenceFromLogprobs([
        { logprob: Math.log(0.7) },
        { logprob: Math.log(0.6) },
      ]);

      expect(result.min).toBeCloseTo(0.6, 5);
      expect(result.max).toBeCloseTo(0.7, 5);
      expect(result.average).toBeCloseTo(0.65, 5);
      expect(result.lowConfidenceTokens).toBe(0);
    });
  });
});
