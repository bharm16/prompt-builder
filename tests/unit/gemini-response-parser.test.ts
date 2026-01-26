import { describe, it, expect } from 'vitest';

import { GeminiResponseParser } from '@server/clients/adapters/gemini/GeminiResponseParser';

describe('GeminiResponseParser', () => {
  describe('error handling', () => {
    it('returns empty text when parts are missing', () => {
      const parser = new GeminiResponseParser();
      const result = parser.extractTextFromParts(undefined);

      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('concatenates multiple text parts', () => {
      const parser = new GeminiResponseParser();
      const result = parser.extractTextFromParts([
        { text: 'Hello' },
        { text: ' ' },
        { text: 'world' },
      ]);

      expect(result).toBe('Hello world');
    });
  });

  describe('core behavior', () => {
    it('normalizes Gemini responses into AIResponse', () => {
      const parser = new GeminiResponseParser();
      const response = parser.parseResponse({
        candidates: [{ content: { parts: [{ text: 'Result' }] } }],
      });

      expect(response.text).toBe('Result');
      expect(response.metadata?.raw).toBeDefined();
    });
  });
});
