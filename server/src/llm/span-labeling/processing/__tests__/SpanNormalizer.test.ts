import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { normalizeSpan } from '../SpanNormalizer';
import { TAXONOMY } from '#shared/taxonomy';

const hashPrefix = (text: string) =>
  createHash('sha256').update(text).digest('hex').substring(0, 8);

describe('normalizeSpan', () => {
  describe('error handling', () => {
    it('returns null when role is invalid in strict mode', () => {
      const result = normalizeSpan(
        { text: 'cat', start: 0, end: 3, role: 'invalid.role' },
        'cat',
        false
      );

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('defaults to subject role and clamps confidence in lenient mode', () => {
      const sourceText = 'cat';
      const result = normalizeSpan(
        { text: 'cat', start: 0, end: 3, role: 'invalid.role' },
        sourceText,
        true
      );

      expect(result?.role).toBe(TAXONOMY.SUBJECT.id);
      expect(result?.confidence).toBe(0.7);
      const expectedId = `${hashPrefix(sourceText)}-0-3-${TAXONOMY.SUBJECT.id}`;
      expect(result?.id).toBe(expectedId);
    });
  });

  describe('core behavior', () => {
    it('normalizes valid roles and clamps confidence above 1', () => {
      const sourceText = 'a wide shot';
      const result = normalizeSpan(
        { text: 'wide shot', start: 2, end: 11, role: 'shot', confidence: 1.5 },
        sourceText,
        false
      );

      expect(result?.role).toBe('shot');
      expect(result?.confidence).toBe(1);
      const expectedId = `${hashPrefix(sourceText)}-2-11-shot`;
      expect(result?.id).toBe(expectedId);
    });
  });
});
