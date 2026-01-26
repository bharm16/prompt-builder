import { describe, it, expect } from 'vitest';

import { GeminiMessageBuilder } from '@server/clients/adapters/gemini/GeminiMessageBuilder';

describe('GeminiMessageBuilder', () => {
  describe('error handling', () => {
    it('falls back to a default user message when history is empty', () => {
      const builder = new GeminiMessageBuilder();
      const result = builder.buildMessages('System prompt', { messages: [] });

      expect(result.contents).toEqual([
        { role: 'user', parts: [{ text: 'Please proceed.' }] },
      ]);
    });
  });

  describe('edge cases', () => {
    it('collects multiple system messages into a system instruction', () => {
      const builder = new GeminiMessageBuilder();
      const result = builder.buildMessages('System prompt', {
        messages: [
          { role: 'system', content: 'First rule' },
          { role: 'system', content: { text: 'Second rule' } },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(result.systemInstruction).toBe('First rule\nSecond rule');
      expect(result.contents[0]?.role).toBe('user');
      expect(result.contents[0]?.parts[0]?.text).toBe('Hello');
    });

    it('stringifies array content into a single message', () => {
      const builder = new GeminiMessageBuilder();
      const result = builder.stringifyContent(['Hello', { text: ' world' }]);

      expect(result).toBe('Hello world');
    });
  });

  describe('core behavior', () => {
    it('builds payloads with JSON mode when applicable', () => {
      const builder = new GeminiMessageBuilder();
      const payload = builder.buildPayload('System prompt', {
        userMessage: 'Hi',
        jsonMode: true,
      });

      expect(payload.generationConfig?.responseMimeType).toBe('application/json');
      expect(payload.contents[0]?.parts[0]?.text).toBe('Hi');
    });

    it('uses responseSchema to force JSON responses', () => {
      const builder = new GeminiMessageBuilder();
      const payload = builder.buildPayload('System prompt', {
        userMessage: 'Hi',
        responseSchema: { type: 'object' },
      });

      expect(payload.generationConfig?.responseSchema).toEqual({ type: 'object' });
      expect(payload.generationConfig?.responseMimeType).toBe('application/json');
    });
  });
});
