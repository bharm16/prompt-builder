import { describe, it, expect } from 'vitest';
import { filterHeaders, isLikelyHeader } from '../HeaderFilter';

const buildSpan = (text: string, start: number, end: number, role?: string) => ({
  text,
  start,
  end,
  ...(role === undefined ? {} : { role }),
});

describe('HeaderFilter', () => {
  describe('error handling', () => {
    it('treats empty or tiny text as header-like', () => {
      expect(isLikelyHeader('')).toBe(true);
      expect(isLikelyHeader('A')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('detects common header patterns', () => {
      expect(isLikelyHeader('## Technical Specs')).toBe(true);
      expect(isLikelyHeader('**Camera**')).toBe(true);
      expect(isLikelyHeader('CAMERA')).toBe(true);
      expect(isLikelyHeader('Duration:')).toBe(true);
      expect(isLikelyHeader('camera')).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('filters header spans and keeps content spans', () => {
      const spans = [
        buildSpan('Camera', 0, 6, 'camera'),
        buildSpan('slow pan across dunes', 7, 30, 'camera.movement'),
      ];

      const result = filterHeaders(spans);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('slow pan across dunes');
      expect(result.notes[0]).toContain('Dropped header/label');
    });
  });
});
