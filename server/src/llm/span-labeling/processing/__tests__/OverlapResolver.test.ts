import { describe, it, expect } from 'vitest';
import { resolveOverlaps } from '../OverlapResolver';

const buildSpan = (text: string, start: number, end: number, role: string, confidence?: number) => ({
  text,
  start,
  end,
  role,
  confidence,
});

describe('resolveOverlaps', () => {
  describe('error handling', () => {
    it('returns original spans when overlaps are allowed', () => {
      const spans = [buildSpan('a', 0, 1, 'subject')];
      const result = resolveOverlaps(spans, true);
      expect(result.spans).toBe(spans);
      expect(result.notes).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('keeps overlapping spans with different parent categories', () => {
      const spans = [
        buildSpan('man', 0, 3, 'subject.identity', 0.9),
        buildSpan('beach', 0, 5, 'environment', 0.4),
      ];

      const result = resolveOverlaps(spans, false);

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('prefers more specific roles when resolving overlaps', () => {
      const spans = [
        buildSpan('man', 0, 3, 'subject', 0.9),
        buildSpan('man', 0, 3, 'subject.identity', 0.2),
      ];

      const result = resolveOverlaps(spans, false);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.role).toBe('subject.identity');
      expect(result.notes[0]).toContain('kept');
    });
  });
});
