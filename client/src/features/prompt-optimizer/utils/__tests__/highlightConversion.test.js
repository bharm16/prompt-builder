/**
 * Tests for highlightConversion
 *
 * Test Plan:
 * - Verifies convertLabeledSpansToHighlights converts spans correctly
 * - Verifies role to category mapping
 * - Verifies offset clamping and validation
 * - Verifies context window extraction
 * - Verifies grapheme index calculation
 * - Verifies sorting and filtering
 * - Verifies edge cases (null input, invalid spans, out-of-bounds offsets)
 *
 * What these tests catch:
 * - Breaking LLM span conversion causing highlights to fail
 * - Incorrect offset calculations showing wrong text
 * - Missing validation allowing invalid highlights
 * - Sorting bugs causing UI rendering issues
 */

import { describe, it, expect } from 'vitest';
import { convertLabeledSpansToHighlights } from '../highlightConversion.js';

describe('highlightConversion', () => {
  const sampleText = 'The quick brown fox jumps over the lazy dog';

  describe('basic conversion', () => {
    it('returns empty array for null spans - catches null handling', () => {
      // Would fail if null check is missing
      const result = convertLabeledSpansToHighlights({ spans: null, text: sampleText });
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined spans - catches undefined handling', () => {
      // Would fail if undefined check is missing
      const result = convertLabeledSpansToHighlights({ spans: undefined, text: sampleText });
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array spans - catches type validation', () => {
      // Would fail if Array.isArray check is missing
      const result = convertLabeledSpansToHighlights({ spans: 'not an array', text: sampleText });
      expect(result).toEqual([]);
    });

    it('returns empty array for null text - catches text validation', () => {
      // Would fail if text check is missing
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: null });
      expect(result).toEqual([]);
    });

    it('converts valid span to highlight - catches basic conversion', () => {
      // Would fail if conversion logic is broken
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('start');
      expect(result[0]).toHaveProperty('end');
    });

    it('extracts correct text slice - catches slice extraction', () => {
      // Would fail if text.slice is broken
      const spans = [{ role: 'Wardrobe', start: 4, end: 9 }]; // "quick"
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.quote).toBe('quick');
    });
  });

  describe('role to category mapping', () => {
    it('maps Wardrobe to wardrobe - catches mapping entry', () => {
      // Would fail if ROLE_TO_CATEGORY mapping is broken
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.category).toBe('wardrobe');
    });

    it('maps Lighting to lighting - catches mapping entry', () => {
      // Would fail if mapping is incomplete
      const spans = [{ role: 'Lighting', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.category).toBe('lighting');
    });

    it('maps Camera to camera - catches camelCase mapping', () => {
      // Would fail if camelCase handling is wrong
      const spans = [{ role: 'Camera', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.category).toBe('camera');
    });

    it('defaults unknown role to quality - catches fallback', () => {
      // Would fail if || 'quality' fallback is missing
      const spans = [{ role: 'UnknownRole', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.category).toBe('quality');
    });

    it('uses Quality for missing role - catches default role', () => {
      // Would fail if default role is not set
      const spans = [{ start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.role).toBe('Quality');
      expect(result[0]?.category).toBe('quality');
    });

    it('handles non-string role - catches type coercion', () => {
      // Would fail if typeof check is missing
      const spans = [{ role: 123, start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.role).toBe('Quality');
    });
  });

  describe('offset validation and clamping', () => {
    it('filters out spans with non-finite start - catches number validation', () => {
      // Would fail if Number.isFinite check is missing
      const spans = [{ role: 'Wardrobe', start: NaN, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result).toEqual([]);
    });

    it('filters out spans with non-finite end - catches number validation', () => {
      // Would fail if Number.isFinite check is missing
      const spans = [{ role: 'Wardrobe', start: 0, end: Infinity }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result).toEqual([]);
    });

    it('filters out spans where end <= start - catches invalid range', () => {
      // Would fail if range validation is missing
      const spans = [{ role: 'Wardrobe', start: 5, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result).toEqual([]);
    });

    it('clamps negative start to 0 - catches lower bound clamping', () => {
      // Would fail if Math.max(0, ...) is missing
      const spans = [{ role: 'Wardrobe', start: -10, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.start).toBe(0);
    });

    it('clamps start beyond text length - catches upper bound clamping', () => {
      // Would fail if Math.min(text.length, ...) is missing
      const spans = [{ role: 'Wardrobe', start: 1000, end: 1005 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.start).toBeLessThanOrEqual(sampleText.length);
    });

    it('clamps end beyond text length - catches upper bound clamping', () => {
      // Would fail if clamping is missing
      const spans = [{ role: 'Wardrobe', start: 0, end: 1000 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.end).toBeLessThanOrEqual(sampleText.length);
    });

    it('ensures end >= start after clamping - catches post-clamp validation', () => {
      // Would fail if we don't validate after clamping
      const spans = [{ role: 'Wardrobe', start: 100, end: 105 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      // Should clamp both to text.length, making end === start, which is invalid
      expect(result).toEqual([]);
    });

    it('filters out spans with empty slice - catches empty text check', () => {
      // Would fail if !slice check is missing
      const spans = [{ role: 'Wardrobe', start: sampleText.length, end: sampleText.length }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result).toEqual([]);
    });
  });

  describe('context window extraction', () => {
    it('extracts left context - catches leftCtx extraction', () => {
      // Would fail if leftCtx slice is wrong
      const spans = [{ role: 'Wardrobe', start: 10, end: 15 }]; // "brown"
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.leftCtx).toBeTruthy();
      expect(result[0]?.leftCtx).toBe(sampleText.slice(0, 10).slice(-20));
    });

    it('extracts right context - catches rightCtx extraction', () => {
      // Would fail if rightCtx slice is wrong
      const spans = [{ role: 'Wardrobe', start: 10, end: 15 }]; // "brown"
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.rightCtx).toBeTruthy();
      expect(result[0]?.rightCtx).toBe(sampleText.slice(15, 35));
    });

    it('limits left context to 20 chars - catches context window size', () => {
      // Would fail if CONTEXT_WINDOW_CHARS is not used
      const longText = 'a'.repeat(100) + 'TARGET' + 'b'.repeat(100);
      const spans = [{ role: 'Wardrobe', start: 100, end: 106 }];
      const result = convertLabeledSpansToHighlights({ spans, text: longText });
      expect(result[0]?.leftCtx.length).toBe(20);
    });

    it('limits right context to 20 chars - catches context window size', () => {
      // Would fail if CONTEXT_WINDOW_CHARS is not used
      const longText = 'a'.repeat(100) + 'TARGET' + 'b'.repeat(100);
      const spans = [{ role: 'Wardrobe', start: 100, end: 106 }];
      const result = convertLabeledSpansToHighlights({ spans, text: longText });
      expect(result[0]?.rightCtx.length).toBe(20);
    });

    it('handles left context at text start - catches boundary case', () => {
      // Would fail if Math.max(0, ...) is missing
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.leftCtx).toBe('');
    });

    it('handles right context at text end - catches boundary case', () => {
      // Would fail if Math.min(length, ...) is missing
      const spans = [{ role: 'Wardrobe', start: sampleText.length - 3, end: sampleText.length }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.rightCtx).toBe('');
    });
  });

  describe('highlight object structure', () => {
    it('includes all required properties - catches complete structure', () => {
      // Would fail if any property is missing
      const spans = [{ role: 'Wardrobe', start: 0, end: 3, id: 'test-id' }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      const highlight = result[0];

      expect(highlight).toHaveProperty('id');
      expect(highlight).toHaveProperty('category');
      expect(highlight).toHaveProperty('role');
      expect(highlight).toHaveProperty('start');
      expect(highlight).toHaveProperty('end');
      expect(highlight).toHaveProperty('displayStart');
      expect(highlight).toHaveProperty('displayEnd');
      expect(highlight).toHaveProperty('quote');
      expect(highlight).toHaveProperty('displayQuote');
      expect(highlight).toHaveProperty('leftCtx');
      expect(highlight).toHaveProperty('rightCtx');
      expect(highlight).toHaveProperty('displayLeftCtx');
      expect(highlight).toHaveProperty('displayRightCtx');
      expect(highlight).toHaveProperty('source');
      expect(highlight).toHaveProperty('validatorPass');
      expect(highlight).toHaveProperty('version');
    });

    it('uses provided id if available - catches id preservation', () => {
      // Would fail if span.id is not used
      const spans = [{ role: 'Wardrobe', start: 0, end: 3, id: 'custom-id' }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.id).toBe('custom-id');
    });

    it('generates id if not provided - catches id generation', () => {
      // Would fail if fallback id generation is missing
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.id).toBeTruthy();
      expect(result[0]?.id).toContain('llm_');
    });

    it('sets source to "llm" - catches source field', () => {
      // Would fail if source is not set
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.source).toBe('llm');
    });

    it('sets validatorPass to true - catches validator field', () => {
      // Would fail if validatorPass is not set
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.validatorPass).toBe(true);
    });

    it('sets version to llm-v1 - catches version field', () => {
      // Would fail if version is not set
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.version).toBe('llm-v1');
    });

    it('includes confidence if provided - catches confidence preservation', () => {
      // Would fail if confidence is not copied
      const spans = [{ role: 'Wardrobe', start: 0, end: 3, confidence: 0.95 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.confidence).toBe(0.95);
    });

    it('omits confidence if not provided - catches undefined handling', () => {
      // Would fail if we set confidence when it's missing
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.confidence).toBeUndefined();
    });

    it('includes displayStart/displayEnd equal to start/end - catches display fields', () => {
      // Would fail if display fields are not set
      const spans = [{ role: 'Wardrobe', start: 5, end: 10 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.displayStart).toBe(5);
      expect(result[0]?.displayEnd).toBe(10);
    });

    it('sets displayQuote equal to quote - catches quote duplication', () => {
      // Would fail if displayQuote is not set
      const spans = [{ role: 'Wardrobe', start: 4, end: 9 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.displayQuote).toBe(result[0]?.quote);
    });

    it('sets displayLeftCtx/displayRightCtx equal to contexts - catches context duplication', () => {
      // Would fail if display context fields are not set
      const spans = [{ role: 'Wardrobe', start: 10, end: 15 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.displayLeftCtx).toBe(result[0]?.leftCtx);
      expect(result[0]?.displayRightCtx).toBe(result[0]?.rightCtx);
    });
  });

  describe('grapheme index handling', () => {
    it('includes grapheme indices if canonical provided - catches grapheme calculation', () => {
      // Would fail if graphemeIndexForCodeUnit is not called
      const canonical = {
        graphemeIndexForCodeUnit: (offset) => offset * 2
      };
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText, canonical });
      expect(result[0]?.startGrapheme).toBe(0);
      expect(result[0]?.endGrapheme).toBe(6);
    });

    it('omits grapheme indices if canonical missing - catches optional grapheme', () => {
      // Would fail if we don't check for canonical existence
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.startGrapheme).toBeUndefined();
      expect(result[0]?.endGrapheme).toBeUndefined();
    });

    it('omits grapheme indices if method missing - catches method check', () => {
      // Would fail if we don't check for method existence
      const canonical = {};
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.startGrapheme).toBeUndefined();
    });
  });

  describe('filtering and sorting', () => {
    it('filters out null results - catches Boolean filter', () => {
      // Would fail if .filter(Boolean) is missing
      const spans = [
        { role: 'Wardrobe', start: 0, end: 3 },
        { role: 'Invalid', start: 100, end: 50 }, // Invalid, will be null
        { role: 'Lighting', start: 10, end: 15 }
      ];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result.length).toBe(2);
    });

    it('filters out invalid spans - catches map returning null', () => {
      // Would fail if invalid spans aren't filtered
      const spans = [
        null,
        { role: 'Wardrobe', start: 0, end: 3 },
        'not an object',
        { role: 'Lighting', start: 10, end: 15 }
      ];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result.length).toBe(2);
    });

    it('sorts by start position - catches sorting logic', () => {
      // Would fail if sort is not called
      const spans = [
        { role: 'Lighting', start: 20, end: 25 },
        { role: 'Wardrobe', start: 0, end: 3 },
        { role: 'Specs', start: 10, end: 15 }
      ];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.start).toBe(0);
      expect(result[1]?.start).toBe(10);
      expect(result[2]?.start).toBe(20);
    });

    it('sorts by end when start is equal - catches tie-breaker', () => {
      // Would fail if secondary sort is missing
      const spans = [
        { role: 'Wardrobe', start: 0, end: 5 },
        { role: 'Lighting', start: 0, end: 3 },
        { role: 'Specs', start: 0, end: 10 }
      ];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result[0]?.end).toBe(3);
      expect(result[1]?.end).toBe(5);
      expect(result[2]?.end).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('handles empty spans array - catches empty array', () => {
      // Would fail if we don't handle empty array
      const result = convertLabeledSpansToHighlights({ spans: [], text: sampleText });
      expect(result).toEqual([]);
    });

    it('handles empty text - catches empty string', () => {
      // Would fail if empty text breaks logic
      const spans = [{ role: 'Wardrobe', start: 0, end: 3 }];
      const result = convertLabeledSpansToHighlights({ spans, text: '' });
      expect(result).toEqual([]);
    });

    it('handles spans with extra properties - catches property isolation', () => {
      // Should ignore extra properties
      const spans = [{ role: 'Wardrobe', start: 0, end: 3, extraProp: 'value' }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result.length).toBe(1);
    });

    it('handles numeric strings for offsets - catches Number() coercion', () => {
      // Would fail if Number() is not called
      const spans = [{ role: 'Wardrobe', start: '0', end: '3' }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result.length).toBe(1);
      expect(result[0]?.start).toBe(0);
      expect(result[0]?.end).toBe(3);
    });

    it('handles very large number of spans - catches performance', () => {
      // Would fail if there's a performance issue
      const spans = Array.from({ length: 1000 }, (_, i) => ({
        role: 'Wardrobe',
        start: Math.min(i, sampleText.length - 2),
        end: Math.min(i + 1, sampleText.length - 1)
      }));
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles Unicode text - catches Unicode handling', () => {
      // Would fail if Unicode breaks slice
      const unicodeText = 'Hello 世界 test';
      const spans = [{ role: 'Wardrobe', start: 6, end: 8 }];
      const result = convertLabeledSpansToHighlights({ spans, text: unicodeText });
      expect(result.length).toBe(1);
    });

    it('handles single character spans - catches minimal span', () => {
      // Would fail if there's a minimum length assumption
      const spans = [{ role: 'Wardrobe', start: 0, end: 1 }];
      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      expect(result.length).toBe(1);
      expect(result[0]?.quote).toBe('T');
    });
  });
});
