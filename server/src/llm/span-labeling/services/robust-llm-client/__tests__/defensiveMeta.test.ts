import { describe, it, expect } from 'vitest';
import { injectDefensiveMeta } from '../defensiveMeta';

const baseOptions = { templateVersion: 'v2.2' };

describe('injectDefensiveMeta', () => {
  describe('error handling', () => {
    it('no-ops when value is falsy', () => {
      expect(() => injectDefensiveMeta(null as unknown as Record<string, unknown>, baseOptions)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('adds default meta and analysis trace when missing', () => {
      const value: Record<string, unknown> = { spans: [{ text: 'cat' }] };
      injectDefensiveMeta(value, baseOptions);

      expect(typeof value.analysis_trace).toBe('string');
      const meta = value.meta as Record<string, unknown>;
      expect(meta.version).toBe('v2.2');
      expect(typeof meta.notes).toBe('string');
    });
  });

  describe('core behavior', () => {
    it('adds NLP metrics when attempts are tracked', () => {
      const value: Record<string, unknown> = { spans: [{ text: 'cat' }], meta: { version: 'v1', notes: '' } };
      injectDefensiveMeta(value, baseOptions, 3);

      const meta = value.meta as Record<string, unknown>;
      expect(meta.nlpAttempted).toBe(true);
      expect(meta.nlpSpansFound).toBe(3);
      expect(meta.nlpBypassFailed).toBe(true);
    });
  });
});
