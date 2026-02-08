import { describe, it, expect } from 'vitest';

import {
  resolveVersionTimestamp,
  isHighlightSnapshot,
} from '@features/prompt-optimizer/PromptCanvas/utils/versioning';

describe('PromptCanvas helpers', () => {
  describe('resolveVersionTimestamp', () => {
    describe('error handling', () => {
      it('returns null for undefined input', () => {
        expect(resolveVersionTimestamp(undefined)).toBeNull();
      });

      it('returns null for invalid string input', () => {
        expect(resolveVersionTimestamp('not-a-date')).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('parses ISO date strings into timestamps', () => {
        const timestamp = resolveVersionTimestamp('2024-01-01T00:00:00Z');

        expect(timestamp).toBeGreaterThan(0);
      });

      it('parses numeric string values', () => {
        const timestamp = resolveVersionTimestamp('1700000000000');

        expect(timestamp).toBe(1700000000000);
      });
    });

    describe('core behavior', () => {
      it('returns numeric timestamps as-is', () => {
        expect(resolveVersionTimestamp(123456)).toBe(123456);
      });
    });
  });

  describe('isHighlightSnapshot', () => {
    describe('error handling', () => {
      it('returns false for null values', () => {
        expect(isHighlightSnapshot(null)).toBe(false);
      });

      it('returns false when spans is not an array', () => {
        expect(isHighlightSnapshot({ spans: 'not-array' })).toBe(false);
      });
    });

    describe('core behavior', () => {
      it('returns true when spans is an array', () => {
        expect(isHighlightSnapshot({ spans: [] })).toBe(true);
      });
    });
  });
});
