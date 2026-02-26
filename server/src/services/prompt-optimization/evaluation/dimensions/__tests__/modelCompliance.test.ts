import { describe, it, expect } from 'vitest';
import { evaluateModelCompliance } from '../modelCompliance';

describe('evaluateModelCompliance', () => {
  describe('edge cases', () => {
    it('returns 1.0 when no targetModel provided', () => {
      expect(evaluateModelCompliance('any prompt text')).toBe(1.0);
    });

    it('returns 1.0 when targetModel is undefined', () => {
      expect(evaluateModelCompliance('any prompt text', undefined)).toBe(1.0);
    });

    it('returns 1.0 for unknown model', () => {
      expect(evaluateModelCompliance('A scene with 5 seconds of action', 'unknownModel')).toBe(1.0);
    });
  });

  describe('Sora model compliance', () => {
    it('penalizes prompt with "seconds" duration for Sora', () => {
      expect(evaluateModelCompliance('A 10 seconds clip of a cat', 'sora')).toBe(0.8);
    });

    it('penalizes prompt with "second" singular for Sora', () => {
      expect(evaluateModelCompliance('A 1 second shot of rain', 'sora')).toBe(0.8);
    });

    it('penalizes prompt with abbreviated "s" duration for Sora', () => {
      expect(evaluateModelCompliance('A 5s tracking shot', 'sora')).toBe(0.8);
    });

    it('returns 1.0 for Sora when no duration pattern found', () => {
      expect(evaluateModelCompliance('A cinematic scene of a sunset', 'sora')).toBe(1.0);
    });

    it('is case-insensitive for model name', () => {
      expect(evaluateModelCompliance('A 10 seconds clip', 'Sora')).toBe(0.8);
      expect(evaluateModelCompliance('A 10 seconds clip', 'SORA')).toBe(0.8);
    });
  });

  describe('Veo3 model compliance', () => {
    it('penalizes prompt with no technical terms for Veo3', () => {
      expect(evaluateModelCompliance('A cat sits on a table', 'veo3')).toBe(0.9);
    });

    it('returns 1.0 for Veo3 when technical terms are present', () => {
      expect(evaluateModelCompliance('A close-up tracking shot of a forest', 'veo3')).toBe(1.0);
    });

    it('is case-insensitive for Veo3 model name', () => {
      expect(evaluateModelCompliance('A cat sits on a table', 'Veo3')).toBe(0.9);
      expect(evaluateModelCompliance('A cat sits on a table', 'VEO3')).toBe(0.9);
    });
  });

  describe('core behavior', () => {
    it('score never goes below 0', () => {
      // Even with maximum penalties
      const score = evaluateModelCompliance('A cat for 5 seconds', 'sora');
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
