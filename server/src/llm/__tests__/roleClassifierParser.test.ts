import { describe, it, expect } from 'vitest';
import { safeParseJSON } from '../roleClassifierParser';

describe('safeParseJSON', () => {
  describe('error handling', () => {
    it('returns null for empty input', () => {
      expect(safeParseJSON(undefined)).toBeNull();
      expect(safeParseJSON('')).toBeNull();
    });

    it('returns null when JSON cannot be recovered', () => {
      const result = safeParseJSON('not { valid json');

      expect(result).toBeNull();
    });

    it('returns null when embedded braces are present but malformed', () => {
      const result = safeParseJSON('prefix { "spans": [ } suffix');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('strips markdown code fences before parsing', () => {
      const result = safeParseJSON('```json\n{"spans": []}\n```');

      expect(result).toEqual({ spans: [] });
    });

    it('extracts JSON from surrounding text', () => {
      const result = safeParseJSON('Noise {"spans":[{"text":"cat"}]} trailing');

      expect(result?.spans?.[0]?.text).toBe('cat');
    });

    it('recovers JSON payload from malformed wrapper text', () => {
      const result = safeParseJSON('LLM response -> {"spans":[{"text":"lens"}]} <- end');

      expect(result).toEqual({ spans: [{ text: 'lens' }] });
    });
  });

  describe('core behavior', () => {
    it('parses valid JSON input', () => {
      const result = safeParseJSON('{"spans":[{"text":"dog"}]}');

      expect(result?.spans?.[0]?.text).toBe('dog');
    });
  });
});
