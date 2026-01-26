import { describe, it, expect } from 'vitest';

import { getOptionsForDimension } from '../hooks/useConvergenceSession.options';

// ============================================================================
// useConvergenceSession.options
// ============================================================================

describe('getOptionsForDimension', () => {
  describe('error handling', () => {
    it('returns an empty array for unknown dimensions', () => {
      const result = getOptionsForDimension('unknown' as unknown as 'direction');
      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('includes default direction options', () => {
      const result = getOptionsForDimension('direction');
      expect(result.some((option) => option.id === 'cinematic' && option.label === 'Cinematic')).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('returns camera motion options with labels', () => {
      const result = getOptionsForDimension('camera_motion');
      expect(result.length).toBeGreaterThan(5);
      expect(result.some((option) => option.id === 'pan_left' && option.label === 'Pan Left')).toBe(true);
    });
  });
});
