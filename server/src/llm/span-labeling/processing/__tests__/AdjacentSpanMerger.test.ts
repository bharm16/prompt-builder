import { describe, it, expect } from 'vitest';
import { mergeAdjacentSpans } from '../AdjacentSpanMerger';

const buildSpan = (
  text: string,
  start: number,
  end: number,
  role: string,
  confidence?: number
) => ({
  text,
  start,
  end,
  role,
  ...(confidence === undefined ? {} : { confidence }),
});

describe('mergeAdjacentSpans', () => {
  describe('error handling', () => {
    it('returns empty result for null spans', () => {
      const result = mergeAdjacentSpans(null, 'Any text');
      expect(result.spans).toEqual([]);
      expect(result.notes).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('does not merge when gap contains non-mergeable characters', () => {
      const text = 'ActionXShot';
      const spans = [
        buildSpan('Action', 0, 6, 'shot', 0.9),
        buildSpan('Shot', 7, 11, 'shot.type', 0.8),
      ];

      const result = mergeAdjacentSpans(spans, text);

      expect(result.spans).toHaveLength(2);
      expect(result.spans[0]?.text).toBe('Action');
      expect(result.spans[1]?.text).toBe('Shot');
      expect(result.notes).toEqual([]);
    });

    it('does not merge when merged span exceeds maxMergedWords', () => {
      const text = 'Action Shot';
      const spans = [
        buildSpan('Action', 0, 6, 'shot', 0.8),
        buildSpan('Shot', 7, 11, 'shot.type', 0.6),
      ];

      const result = mergeAdjacentSpans(spans, text, { maxMergedWords: 1 });

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('merges adjacent compatible spans and selects more specific role', () => {
      const text = 'Action Shot';
      const spans = [
        buildSpan('Action', 0, 6, 'shot', 0.8),
        buildSpan('Shot', 7, 11, 'shot.type', 0.6),
      ];

      const result = mergeAdjacentSpans(spans, text);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('Action Shot');
      expect(result.spans[0]?.role).toBe('shot.type');
      expect(result.spans[0]?.confidence).toBeCloseTo(0.7, 5);
      expect(result.notes[0]).toContain('Merged 2 adjacent shot spans');
    });
  });
});
