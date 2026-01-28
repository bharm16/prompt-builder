import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { describeNestedValue, formatLabel } from '../formatting';

describe('formatting utilities', () => {
  describe('error handling', () => {
    it('returns empty string for nullish values in describeNestedValue', () => {
      expect(describeNestedValue(null)).toBe('');
      expect(describeNestedValue(undefined)).toBe('');
    });

    it('returns empty string for falsy primitives in describeNestedValue', () => {
      expect(describeNestedValue(0)).toBe('');
      expect(describeNestedValue(false)).toBe('');
    });
  });

  describe('edge cases', () => {
    it('collapses underscores, dashes, and spaces in formatLabel', () => {
      expect(formatLabel('camera_movement--style')).toBe('Camera movement style');
      expect(formatLabel('  multi   space_label ')).toBe('Multi space label');
    });

    it('joins array values with commas in describeNestedValue', () => {
      expect(describeNestedValue(['alpha', 'beta', 'gamma'])).toBe('alpha, beta, gamma');
    });
  });

  describe('core behavior', () => {
    it('never returns labels containing underscores or consecutive spaces', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = formatLabel(input);
          expect(result).not.toMatch(/_/);
          expect(result).not.toMatch(/\s{2,}/);
        }),
        { numRuns: 100 }
      );
    });
  });
});
