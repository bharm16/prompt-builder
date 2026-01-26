import { describe, it, expect } from 'vitest';
import { buildUserPayload, cleanJsonEnvelope, parseJson } from '../jsonUtils';

describe('jsonUtils', () => {
  describe('error handling', () => {
    it('returns an error result for invalid JSON', () => {
      const result = parseJson('{not valid json');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Invalid JSON');
      }
    });
  });

  describe('edge cases', () => {
    it('removes markdown code fences from JSON strings', () => {
      const wrapped = '```json\n{"ok": true}\n```';
      expect(cleanJsonEnvelope(wrapped)).toBe('{"ok": true}');
      const result = parseJson(wrapped);
      expect(result.ok).toBe(true);
    });

    it('recovers JSON embedded in surrounding text', () => {
      const raw = 'Noise before {"spans": [{"text": "cat", "role": "subject"}]} trailing';
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as { spans?: Array<{ text: string }> };
        expect(value.spans?.[0]?.text).toBe('cat');
      }
    });

    it('escapes unescaped newlines inside JSON strings', () => {
      const raw = '{"text": "line1\nline2"}';
      const result = parseJson(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as { text?: string };
        expect(value.text).toBe('line1\nline2');
      }
    });
  });

  describe('core behavior', () => {
    it('builds user payload with wrapped text and validation', () => {
      const payload = buildUserPayload({
        task: 'label',
        policy: { allowOverlap: false },
        text: 'A prompt',
        templateVersion: 'v1',
        validation: { errors: ['bad'] },
      });

      const parsed = JSON.parse(payload) as {
        text: string;
        validation?: { errors: string[] };
      };

      expect(parsed.text).toContain('<user_input>');
      expect(parsed.text).toContain('A prompt');
      expect(parsed.validation?.errors[0]).toBe('bad');
    });
  });
});
