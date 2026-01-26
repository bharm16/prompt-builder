import { describe, it, expect } from 'vitest';

import { validateLLMResponse, detectRefusal } from '@server/clients/adapters/ResponseValidator';

describe('ResponseValidator', () => {
  describe('error handling', () => {
    it('flags empty responses as invalid', () => {
      const result = validateLLMResponse('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Empty response');
      expect(result.confidence).toBe(0);
    });

    it('detects refusal responses', () => {
      const text = "I'm sorry, but I can't comply with that request.";
      const result = validateLLMResponse(text);

      expect(detectRefusal(text)).toBe(true);
      expect(result.isRefusal).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Response appears to be a refusal');
    });

    it('returns errors when expected JSON is missing', () => {
      const result = validateLLMResponse('No JSON here', { expectJson: true });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('No object found'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('strips preamble and postamble text when extracting JSON', () => {
      const result = validateLLMResponse(
        "Sure, here's the JSON: {\"value\": 1} Let me know if you need anything else.",
        { expectJson: true }
      );

      expect(result.hasPreamble).toBe(true);
      expect(result.hasPostamble).toBe(true);
      expect(result.cleanedText).toBe('{"value": 1}');
      expect(result.parsed).toEqual({ value: 1 });
    });

    it('flags responses missing the expected array payload', () => {
      const result = validateLLMResponse('{"value": 1}', {
        expectJson: true,
        expectArray: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No array found in response');
    });
  });

  describe('core behavior', () => {
    it('validates required fields in parsed JSON', () => {
      const result = validateLLMResponse('{"parent": {}}', {
        expectJson: true,
        requiredFields: ['parent.child'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required fields: parent.child');
    });
  });
});
