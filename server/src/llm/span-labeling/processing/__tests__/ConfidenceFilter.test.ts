import { describe, it, expect } from 'vitest';
import { filterByConfidence } from '../ConfidenceFilter';

const buildSpan = (text: string, start: number, end: number, confidence?: number) => ({
  text,
  start,
  end,
  ...(confidence === undefined ? {} : { confidence }),
});

describe('filterByConfidence', () => {
  describe('error handling', () => {
    it('drops spans with non-numeric confidence and records note', () => {
      const spans = [
        { text: 'low', start: 0, end: 3, confidence: 'bad' as unknown as number },
      ];

      const result = filterByConfidence(spans, 0.2);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('confidence 0.00');
      expect(result.notes[0]).toContain('below threshold 0.2');
    });
  });

  describe('edge cases', () => {
    it('keeps spans when minConfidence is 0 even if confidence is missing', () => {
      const spans = [
        buildSpan('keep', 0, 4),
      ];

      const result = filterByConfidence(spans, 0);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('keep');
      expect(result.notes).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('filters out spans below threshold and preserves others', () => {
      const spans = [
        buildSpan('keep', 0, 4, 0.9),
        buildSpan('drop', 5, 9, 0.1),
      ];

      const result = filterByConfidence(spans, 0.5);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('keep');
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toContain('Dropped "drop"');
    });
  });
});
