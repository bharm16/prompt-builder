/**
 * Tests for tokenBoundaries
 *
 * Test Plan:
 * - Verifies isWordBoundary detects word boundaries correctly
 * - Verifies snapSpanToTokenBoundaries snaps to word edges
 * - Verifies rangeOverlaps detects range overlaps
 * - Verifies edge cases (empty text, boundaries, special characters)
 *
 * What these tests catch:
 * - Breaking word boundary detection causing word splitting
 * - Incorrect span snapping creating malformed selections
 * - Overlap detection failures causing highlighting bugs
 */

import { describe, it, expect } from 'vitest';
import { isWordBoundary, snapSpanToTokenBoundaries, rangeOverlaps } from '../tokenBoundaries.js';

describe('tokenBoundaries', () => {
  describe('isWordBoundary', () => {
    it('returns true at start of text - catches start boundary', () => {
      // Would fail if index <= 0 check is wrong
      const result = isWordBoundary('hello', 0);
      expect(result).toBe(true);
    });

    it('returns true at end of text - catches end boundary', () => {
      // Would fail if index >= length check is wrong
      const text = 'hello';
      const result = isWordBoundary(text, text.length);
      expect(result).toBe(true);
    });

    it('returns true between word and space - catches word/space boundary', () => {
      // Would fail if regex boundary detection is broken
      const result = isWordBoundary('hello world', 5);
      expect(result).toBe(true);
    });

    it('returns true between space and word - catches space/word boundary', () => {
      // Would fail if regex boundary detection is broken
      const result = isWordBoundary('hello world', 6);
      expect(result).toBe(true);
    });

    it('returns false in middle of word - catches non-boundary', () => {
      // Would fail if /\w/ regex is too permissive
      const result = isWordBoundary('hello', 2);
      expect(result).toBe(false);
    });

    it('returns true between word and punctuation - catches punctuation boundary', () => {
      // Would fail if punctuation is treated as word character
      const result = isWordBoundary('hello!', 5);
      expect(result).toBe(true);
    });

    it('returns true between punctuation and word - catches punctuation boundary', () => {
      // Would fail if punctuation is treated as word character
      const result = isWordBoundary('!hello', 1);
      expect(result).toBe(true);
    });

    it('handles numbers as word characters - catches digit handling', () => {
      // Would fail if /\w/ doesn't match digits
      const result = isWordBoundary('abc123', 3);
      expect(result).toBe(false); // In middle of word+number
    });

    it('handles underscores as word characters - catches underscore handling', () => {
      // Would fail if /\w/ doesn't match underscore
      const result = isWordBoundary('hello_world', 5);
      expect(result).toBe(false); // Underscore joins words
    });

    it('handles hyphen as boundary - catches hyphen handling', () => {
      // Would fail if hyphen is treated as word character
      const result = isWordBoundary('hello-world', 5);
      expect(result).toBe(true);
    });

    it('handles negative index - catches bounds checking', () => {
      // Would fail if index <= 0 doesn't handle negative
      const result = isWordBoundary('hello', -1);
      expect(result).toBe(true);
    });

    it('handles index beyond length - catches bounds checking', () => {
      // Would fail if index >= length doesn't handle overflow
      const result = isWordBoundary('hello', 100);
      expect(result).toBe(true);
    });
  });

  describe('snapSpanToTokenBoundaries', () => {
    it('returns null for null text - catches null handling', () => {
      // Would fail if null check is missing
      const result = snapSpanToTokenBoundaries(null, 0, 5);
      expect(result).toBeNull();
    });

    it('returns null for empty string - catches empty handling', () => {
      // Would fail if empty string check is missing
      const result = snapSpanToTokenBoundaries('', 0, 5);
      expect(result).toBeNull();
    });

    it('returns null for non-finite start - catches number validation', () => {
      // Would fail if Number.isFinite check is missing
      const result = snapSpanToTokenBoundaries('hello world', NaN, 5);
      expect(result).toBeNull();
    });

    it('returns null for non-finite end - catches number validation', () => {
      // Would fail if Number.isFinite check is missing
      const result = snapSpanToTokenBoundaries('hello world', 0, Infinity);
      expect(result).toBeNull();
    });

    it('returns null when end <= start - catches invalid range', () => {
      // Would fail if range validation is missing
      const result = snapSpanToTokenBoundaries('hello world', 5, 3);
      expect(result).toBeNull();
    });

    it('snaps to word boundaries - catches basic snapping', () => {
      // Would fail if snapping logic is broken
      // "hello world" - selecting from middle of "hello" to middle of "world"
      const result = snapSpanToTokenBoundaries('hello world', 2, 9);
      expect(result).not.toBeNull();
      if (result) {
        // Should snap to start of "hello" (0) and end of "world" (11)
        expect(result.start).toBe(0);
        expect(result.end).toBe(11);
      }
    });

    it('preserves already-snapped boundaries - catches no-change case', () => {
      // Would fail if we change already-correct boundaries
      const result = snapSpanToTokenBoundaries('hello world', 0, 5);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.start).toBe(0);
        expect(result.end).toBe(5);
      }
    });

    it('snaps start backward to word start - catches start snapping', () => {
      // Would fail if start snapping is broken
      const result = snapSpanToTokenBoundaries('hello world', 3, 5);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.start).toBe(0); // Snaps to "hello" start
      }
    });

    it('snaps end forward to word end - catches end snapping', () => {
      // Would fail if end snapping is broken
      const result = snapSpanToTokenBoundaries('hello world', 6, 8);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.end).toBe(11); // Snaps to "world" end
      }
    });

    it('handles negative start by clamping to 0 - catches bounds clamping', () => {
      // Would fail if Math.max(0, start) is missing
      const result = snapSpanToTokenBoundaries('hello world', -5, 5);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.start).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles end beyond length by clamping - catches bounds clamping', () => {
      // Would fail if Math.min(length, end) is missing
      const result = snapSpanToTokenBoundaries('hello', 0, 100);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.end).toBeLessThanOrEqual('hello'.length);
      }
    });

    it('returns null if snapping results in invalid range - catches validation', () => {
      // Would fail if we don't check safeEnd <= safeStart
      const result = snapSpanToTokenBoundaries('hello', 0, 0);
      expect(result).toBeNull();
    });

    it('handles punctuation boundaries - catches punctuation handling', () => {
      // Would fail if punctuation isn't treated as boundary
      const result = snapSpanToTokenBoundaries('hello, world', 4, 9);
      expect(result).not.toBeNull();
    });

    it('handles multiple words - catches multi-word snapping', () => {
      // Would fail if snapping only works for single words
      const result = snapSpanToTokenBoundaries('one two three', 2, 10);
      expect(result).not.toBeNull();
      if (result) {
        // Should snap to start of "one" and end of "three"
        expect(result.start).toBe(0);
        expect(result.end).toBe(13);
      }
    });

    it('handles text with numbers - catches number handling', () => {
      // Would fail if numbers aren't treated as word chars
      const result = snapSpanToTokenBoundaries('test123 value', 5, 9);
      expect(result).not.toBeNull();
    });

    it('handles underscores in identifiers - catches underscore handling', () => {
      // Would fail if underscores break word detection
      const result = snapSpanToTokenBoundaries('hello_world test', 5, 13);
      expect(result).not.toBeNull();
      if (result) {
        // Underscore joins words, so should include whole hello_world
        expect(result.start).toBe(0);
      }
    });
  });

  describe('rangeOverlaps', () => {
    it('returns false for empty ranges array - catches empty array handling', () => {
      // Would fail if we don't handle empty array
      const result = rangeOverlaps([], 0, 5);
      expect(result).toBe(false);
    });

    it('returns false for non-overlapping ranges - catches no overlap detection', () => {
      // Would fail if overlap logic is wrong
      const ranges = [{ start: 0, end: 5 }, { start: 10, end: 15 }];
      const result = rangeOverlaps(ranges, 6, 9);
      expect(result).toBe(false);
    });

    it('returns true for overlapping range - catches overlap detection', () => {
      // Would fail if !(end <= start || start >= end) logic is broken
      const ranges = [{ start: 5, end: 10 }];
      const result = rangeOverlaps(ranges, 7, 12);
      expect(result).toBe(true);
    });

    it('returns false for adjacent non-overlapping ranges - catches boundary condition', () => {
      // Would fail if we treat adjacent as overlapping
      const ranges = [{ start: 0, end: 5 }];
      const result = rangeOverlaps(ranges, 5, 10);
      expect(result).toBe(false); // end === start is not overlap
    });

    it('returns false when new range ends at existing start - catches boundary', () => {
      // Would fail if end === start is treated as overlap
      const ranges = [{ start: 5, end: 10 }];
      const result = rangeOverlaps(ranges, 0, 5);
      expect(result).toBe(false);
    });

    it('returns true for fully contained range - catches containment overlap', () => {
      // Would fail if containment isn't detected as overlap
      const ranges = [{ start: 5, end: 15 }];
      const result = rangeOverlaps(ranges, 7, 12);
      expect(result).toBe(true);
    });

    it('returns true when new range contains existing - catches reverse containment', () => {
      // Would fail if reverse containment isn't detected
      const ranges = [{ start: 7, end: 12 }];
      const result = rangeOverlaps(ranges, 5, 15);
      expect(result).toBe(true);
    });

    it('returns true for partial overlap at start - catches start overlap', () => {
      // Would fail if start overlap isn't detected
      const ranges = [{ start: 5, end: 10 }];
      const result = rangeOverlaps(ranges, 3, 7);
      expect(result).toBe(true);
    });

    it('returns true for partial overlap at end - catches end overlap', () => {
      // Would fail if end overlap isn't detected
      const ranges = [{ start: 5, end: 10 }];
      const result = rangeOverlaps(ranges, 8, 12);
      expect(result).toBe(true);
    });

    it('checks all ranges in array - catches array iteration', () => {
      // Would fail if .some() doesn't check all elements
      const ranges = [
        { start: 0, end: 5 },
        { start: 10, end: 15 },
        { start: 20, end: 25 }
      ];
      const result = rangeOverlaps(ranges, 12, 17);
      expect(result).toBe(true); // Overlaps second range
    });

    it('returns false when no range in array overlaps - catches comprehensive check', () => {
      // Would fail if any check is too permissive
      const ranges = [
        { start: 0, end: 5 },
        { start: 10, end: 15 },
        { start: 20, end: 25 }
      ];
      const result = rangeOverlaps(ranges, 6, 9);
      expect(result).toBe(false);
    });

    it('handles identical ranges - catches exact match', () => {
      // Would fail if exact match isn't treated as overlap
      const ranges = [{ start: 5, end: 10 }];
      const result = rangeOverlaps(ranges, 5, 10);
      expect(result).toBe(true);
    });

    it('handles zero-width ranges - catches degenerate case', () => {
      // Would fail if zero-width isn't handled
      const ranges = [{ start: 5, end: 5 }];
      const result = rangeOverlaps(ranges, 4, 6);
      expect(result).toBe(false); // Zero-width range doesn't overlap
    });

    it('handles single-character ranges - catches minimal range', () => {
      // Would fail if single-char ranges break logic
      const ranges = [{ start: 5, end: 6 }];
      const result = rangeOverlaps(ranges, 5, 6);
      expect(result).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('snapping then overlap check workflow - catches combined usage', () => {
      // Real-world workflow: snap then check overlap
      const text = 'hello world test';
      const existing = [{ start: 0, end: 5 }];

      // Try to add selection in middle of "world"
      const snapped = snapSpanToTokenBoundaries(text, 7, 9);
      if (snapped) {
        // Should snap to full "world" (6-11)
        const overlaps = rangeOverlaps(existing, snapped.start, snapped.end);
        expect(overlaps).toBe(false); // "hello" and "world" don't overlap
      }
    });

    it('handles complex text with mixed boundaries - catches comprehensive handling', () => {
      // Would fail if any boundary type breaks the logic
      const text = 'hello-world_test 123! value';
      const snapped = snapSpanToTokenBoundaries(text, 10, 20);
      expect(snapped).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles single character text - catches minimal text', () => {
      // Would fail if there's a minimum length assumption
      const result = snapSpanToTokenBoundaries('a', 0, 1);
      expect(result).not.toBeNull();
    });

    it('handles text with only spaces - catches whitespace-only', () => {
      // Would fail if whitespace breaks logic
      const result = snapSpanToTokenBoundaries('   ', 0, 2);
      expect(result).not.toBeNull();
    });

    it('handles Unicode text - catches Unicode handling', () => {
      // Would fail if Unicode breaks regex
      const result = snapSpanToTokenBoundaries('hello 世界', 5, 7);
      expect(result).not.toBeNull();
    });

    it('handles very long text - catches performance', () => {
      // Would fail if there's a performance issue with long text
      const longText = 'word '.repeat(1000);
      const result = snapSpanToTokenBoundaries(longText, 100, 150);
      expect(result).not.toBeNull();
    });
  });
});
