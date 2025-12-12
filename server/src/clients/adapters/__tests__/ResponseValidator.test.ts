import { describe, it, expect } from 'vitest';
import {
  validateLLMResponse,
  detectRefusal,
  attemptJsonRepair,
  calculateConfidenceFromLogprobs,
} from '../ResponseValidator.js';

describe('ResponseValidator', () => {
  describe('validateLLMResponse', () => {
    it('accepts valid JSON objects and parses them', () => {
      const result = validateLLMResponse('{"spans": [], "meta": {"version":"v1"}}', { expectJson: true });
      expect(result.isValid).toBe(true);
      expect(result.parsed).toEqual({ spans: [], meta: { version: 'v1' } });
    });

    it('strips common preambles and markdown fences', () => {
      const fenced = validateLLMResponse('```json\\n{"spans": []}\\n```', { expectJson: true });
      expect(fenced.isValid).toBe(true);
      expect(fenced.hasPreamble).toBe(true);
      expect(fenced.parsed).toEqual({ spans: [] });

      const preambled = validateLLMResponse('Here is the JSON:\\n{"spans": []}', { expectJson: true });
      expect(preambled.isValid).toBe(true);
      expect(preambled.hasPreamble).toBe(true);
    });

    it('flags truncated or malformed JSON as invalid', () => {
      const truncated = validateLLMResponse('{"spans": [{"text": "test"', { expectJson: true });
      expect(truncated.isValid).toBe(false);
      expect(truncated.errors.length).toBeGreaterThan(0);
      expect(truncated.isTruncated || truncated.warnings.some(w => w.toLowerCase().includes('truncated'))).toBe(true);
    });

    it('enforces array expectation when requested', () => {
      const ok = validateLLMResponse('[{"text":"a"}]', { expectJson: true, expectArray: true });
      expect(ok.isValid).toBe(true);
      expect(Array.isArray(ok.parsed)).toBe(true);

      // When expecting an array, the validator will extract the first JSON array
      // even if it is wrapped in an outer object.
      const wrapped = validateLLMResponse('{"spans":[]}', { expectJson: true, expectArray: true });
      expect(wrapped.isValid).toBe(true);
      expect(wrapped.parsed).toEqual([]);
    });
  });

  describe('detectRefusal', () => {
    it('detects refusal patterns without false positives', () => {
      expect(detectRefusal("I cannot help with that request.")).toBe(true);
      expect(detectRefusal('{"spans": []}')).toBe(false);
    });
  });

  describe('attemptJsonRepair', () => {
    it('repairs simple structural issues and records changes', () => {
      const trailing = attemptJsonRepair('{"a":1,}');
      expect(trailing.repaired).toBe('{"a":1}');
      expect(trailing.changes).toContain('Removed trailing commas');

      const unquoted = attemptJsonRepair('{spans: []}');
      expect(unquoted.repaired).toContain('"spans"');
      expect(unquoted.changes).toContain('Added quotes to unquoted keys');

      const unclosed = attemptJsonRepair('{"spans": [{"text": "test"');
      expect(unclosed.changes.some(c => c.toLowerCase().includes('closing'))).toBe(true);
      expect(unclosed.repaired.length).toBeGreaterThan('{"spans": [{"text": "test"'.length);
    });
  });

  describe('calculateConfidenceFromLogprobs', () => {
    it('computes averages and low-confidence counts', () => {
      const result = calculateConfidenceFromLogprobs([
        { logprob: Math.log(0.9) },
        { logprob: Math.log(0.4) },
        { logprob: Math.log(0.8) },
      ]);
      expect(result.average).toBeGreaterThan(0);
      expect(result.lowConfidenceTokens).toBe(1);
    });
  });
});
