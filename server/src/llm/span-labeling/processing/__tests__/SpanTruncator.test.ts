import { describe, it, expect } from 'vitest';
import { truncateToMaxSpans } from '../SpanTruncator';

const buildSpan = (text: string, start: number, end: number, confidence?: number) => ({
  text,
  start,
  end,
  ...(confidence === undefined ? {} : { confidence }),
});

describe('truncateToMaxSpans', () => {
  describe('error handling', () => {
    it('returns empty spans when maxSpans is 0', () => {
      const spans = [buildSpan('a', 0, 1, 0.9)];
      const result = truncateToMaxSpans(spans, 0);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('removed 1 spans');
    });
  });

  describe('edge cases', () => {
    it('returns original spans when already within max limit', () => {
      const spans = [buildSpan('a', 0, 1, 0.2)];
      const result = truncateToMaxSpans(spans, 2);

      expect(result.spans).toBe(spans);
      expect(result.notes).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('keeps highest-confidence spans and re-sorts by position', () => {
      const spans = [
        buildSpan('late', 10, 14, 0.5),
        buildSpan('early', 0, 5, 0.9),
        buildSpan('mid', 5, 8, 0.9),
      ];

      const result = truncateToMaxSpans(spans, 2);

      expect(result.spans).toHaveLength(2);
      expect(result.spans[0]?.text).toBe('early');
      expect(result.spans[1]?.text).toBe('mid');
      expect(result.notes[0]).toContain('Truncated spans to maxSpans=2');
    });
  });
});
