import { describe, it, expect } from 'vitest';
import { getCachedLabels, hashKey, setCachedLabels } from '../roleClassifierCache';
import type { InputSpan, LabeledSpan } from '../types';

describe('roleClassifierCache', () => {
  const spans: InputSpan[] = [
    { text: 'cat', start: 0, end: 3 },
    { text: 'runs', start: 4, end: 8 },
  ];

  describe('error handling', () => {
    it('returns undefined for missing cache entries', () => {
      const key = hashKey(spans, 'v1');

      expect(getCachedLabels(key)).toBeUndefined();
    });

    it('does not return labels stored under a different key', () => {
      const keyA = hashKey(spans, 'v1');
      const keyB = hashKey(spans, 'v2');
      const labeled: LabeledSpan[] = [
        { text: 'cat', start: 0, end: 3, role: 'subject', confidence: 0.9 },
      ];

      setCachedLabels(keyA, labeled);

      expect(getCachedLabels(keyB)).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('produces deterministic hashes for the same inputs', () => {
      const first = hashKey(spans, 'v1');
      const second = hashKey(spans, 'v1');

      expect(first).toBe(second);
    });

    it('changes hashes when spans or version change', () => {
      const base = hashKey(spans, 'v1');
      const differentVersion = hashKey(spans, 'v2');
      const differentSpans = hashKey([{ text: 'cat', start: 0, end: 3 }], 'v1');

      expect(differentVersion).not.toBe(base);
      expect(differentSpans).not.toBe(base);
    });
  });

  describe('core behavior', () => {
    it('stores and retrieves cached labels', () => {
      const key = hashKey(spans, 'v1');
      const labeled: LabeledSpan[] = [
        { text: 'cat', start: 0, end: 3, role: 'subject', confidence: 0.9 },
        { text: 'runs', start: 4, end: 8, role: 'action', confidence: 0.8 },
      ];

      setCachedLabels(key, labeled);

      const cached = getCachedLabels(key);
      expect(cached).toEqual(labeled);
    });
  });
});
