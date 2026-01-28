import { describe, expect, it } from 'vitest';

import { attemptJsonRepair } from '@clients/adapters/jsonRepair';
import { calculateConfidenceFromLogprobs } from '@clients/adapters/logprobConfidence';

describe('attemptJsonRepair', () => {
  describe('error handling', () => {
    it('adds missing closing braces for truncated objects', () => {
      const { repaired, changes } = attemptJsonRepair('{"a": 1');

      expect(repaired).toBe('{"a": 1}');
      expect(changes).toContain('Added 1 closing braces');
    });
  });

  describe('edge cases', () => {
    it('quotes unquoted keys and converts single quotes', () => {
      const { repaired, changes } = attemptJsonRepair("{'foo':'bar'}{baz:'qux'}");

      expect(repaired).toContain('{"foo":\'bar\'},{"baz":\'qux\'}');
      expect(changes).toContain('Added missing commas between objects');
      expect(changes).toContain('Converted single quotes to double quotes');
      expect(changes).toContain('Added quotes to unquoted keys');
    });
  });

  describe('core behavior', () => {
    it('removes trailing commas and closes arrays', () => {
      const { repaired, changes } = attemptJsonRepair('{"items":[1,2,],}');

      expect(repaired).toBe('{"items":[1,2]}');
      expect(changes).toContain('Removed trailing commas');
    });
  });
});

describe('calculateConfidenceFromLogprobs', () => {
  describe('error handling', () => {
    it('returns zeros when no logprobs are provided', () => {
      expect(calculateConfidenceFromLogprobs([])).toEqual({
        average: 0,
        min: 0,
        max: 0,
        lowConfidenceTokens: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('respects explicit probability overrides', () => {
      const result = calculateConfidenceFromLogprobs([
        { logprob: -10, probability: 0.2 },
        { logprob: -0.1, probability: 0.8 },
      ]);

      expect(result.average).toBeCloseTo(0.5, 5);
      expect(result.min).toBe(0.2);
      expect(result.max).toBe(0.8);
      expect(result.lowConfidenceTokens).toBe(1);
    });
  });

  describe('core behavior', () => {
    it('derives confidence metrics from logprob values', () => {
      const result = calculateConfidenceFromLogprobs([
        { logprob: Math.log(0.5) },
        { logprob: Math.log(0.9) },
      ]);

      expect(result.average).toBeCloseTo(0.7, 5);
      expect(result.min).toBeCloseTo(0.5, 5);
      expect(result.max).toBeCloseTo(0.9, 5);
      expect(result.lowConfidenceTokens).toBe(0);
    });
  });
});
