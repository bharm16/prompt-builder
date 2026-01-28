import { describe, it, expect } from 'vitest';
import { deduplicateSpans } from '../SpanDeduplicator';

const buildSpan = (text: string, start: number, end: number) => ({
  text,
  start,
  end,
});

describe('deduplicateSpans', () => {
  describe('error handling', () => {
    it('records notes for duplicate spans based on position and text', () => {
      const spans = [
        buildSpan('cat', 0, 3),
        buildSpan('cat', 0, 3),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans).toHaveLength(1);
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toContain('duplicate span');
    });
  });

  describe('edge cases', () => {
    it('returns empty results for empty input', () => {
      const result = deduplicateSpans([]);
      expect(result.spans).toEqual([]);
      expect(result.notes).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('keeps unique spans in order', () => {
      const spans = [
        buildSpan('cat', 0, 3),
        buildSpan('runs', 4, 8),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans).toHaveLength(2);
      expect(result.spans[0]?.text).toBe('cat');
      expect(result.spans[1]?.text).toBe('runs');
    });
  });
});
