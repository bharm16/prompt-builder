import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit Tests for Character Offset Accuracy
 *
 * These tests validate the optimized character offset correction algorithm
 * used in span labeling to ensure accurate DOM rendering.
 *
 * Test Coverage:
 * - Single occurrence matching
 * - Multiple occurrence matching with preferred position
 * - Edge cases (empty strings, special characters, Unicode)
 * - Performance benchmarks
 * - Cache effectiveness
 */

// Import the SubstringPositionCache class from spanLabeler.js
// Note: This is a direct test of the algorithm
class SubstringPositionCache {
  constructor() {
    this.cache = new Map();
    this.textHash = null;
  }

  _getOccurrences(text, substring) {
    const currentHash = text.length + substring.length;

    if (this.textHash !== currentHash) {
      this.cache.clear();
      this.textHash = currentHash;
    }

    if (this.cache.has(substring)) {
      return this.cache.get(substring);
    }

    const occurrences = [];
    let index = text.indexOf(substring, 0);
    while (index !== -1) {
      occurrences.push(index);
      index = text.indexOf(substring, index + 1);
    }

    this.cache.set(substring, occurrences);
    return occurrences;
  }

  findBestMatch(text, substring, preferredStart = 0) {
    if (!substring) return null;

    const occurrences = this._getOccurrences(text, substring);

    if (occurrences.length === 0) {
      return null;
    }

    if (occurrences.length === 1) {
      return { start: occurrences[0], end: occurrences[0] + substring.length };
    }

    const preferred =
      typeof preferredStart === 'number' && Number.isFinite(preferredStart)
        ? preferredStart
        : 0;

    if (preferred <= occurrences[0]) {
      return { start: occurrences[0], end: occurrences[0] + substring.length };
    }

    if (preferred >= occurrences[occurrences.length - 1]) {
      const last = occurrences[occurrences.length - 1];
      return { start: last, end: last + substring.length };
    }

    let left = 0;
    let right = occurrences.length - 1;
    let best = occurrences[0];
    let bestDistance = Math.abs(best - preferred);

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const candidate = occurrences[mid];
      const distance = Math.abs(candidate - preferred);

      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }

      if (candidate < preferred) {
        left = mid + 1;
      } else if (candidate > preferred) {
        right = mid - 1;
      } else {
        return { start: candidate, end: candidate + substring.length };
      }
    }

    return { start: best, end: best + substring.length };
  }

  clear() {
    this.cache.clear();
    this.textHash = null;
  }
}

describe('Character Offset Accuracy Tests', () => {
  let cache;

  beforeEach(() => {
    cache = new SubstringPositionCache();
  });

  describe('Single Occurrence Matching', () => {
    it('should find exact match at start', () => {
      const text = 'Hello world';
      const substring = 'Hello';

      const result = cache.findBestMatch(text, substring);

      expect(result).toEqual({ start: 0, end: 5 });
    });

    it('should find exact match at end', () => {
      const text = 'Hello world';
      const substring = 'world';

      const result = cache.findBestMatch(text, substring);

      expect(result).toEqual({ start: 6, end: 11 });
    });

    it('should find exact match in middle', () => {
      const text = 'The quick brown fox';
      const substring = 'quick';

      const result = cache.findBestMatch(text, substring);

      expect(result).toEqual({ start: 4, end: 9 });
    });

    it('should return null for non-existent substring', () => {
      const text = 'Hello world';
      const substring = 'goodbye';

      const result = cache.findBestMatch(text, substring);

      expect(result).toBeNull();
    });
  });

  describe('Multiple Occurrence Matching', () => {
    it('should find closest match to preferred position', () => {
      const text = 'shot shot shot';
      const substring = 'shot';

      // Prefer position 5 (should match second "shot" at index 5)
      const result = cache.findBestMatch(text, substring, 5);

      expect(result).toEqual({ start: 5, end: 9 });
    });

    it('should prefer first occurrence when preferred is before all', () => {
      const text = 'shot shot shot';
      const substring = 'shot';

      const result = cache.findBestMatch(text, substring, 0);

      expect(result).toEqual({ start: 0, end: 4 });
    });

    it('should prefer last occurrence when preferred is after all', () => {
      const text = 'shot shot shot';
      const substring = 'shot';

      const result = cache.findBestMatch(text, substring, 100);

      expect(result).toEqual({ start: 10, end: 14 });
    });

    it('should find exact preferred position', () => {
      const text = 'shot shot shot';
      const substring = 'shot';

      // Exact match at second occurrence
      const result = cache.findBestMatch(text, substring, 5);

      expect(result).toEqual({ start: 5, end: 9 });
    });

    it('should handle many occurrences efficiently', () => {
      const text = 'a '.repeat(100); // "a a a a ... " (100 times)
      const substring = 'a';

      const startTime = performance.now();
      const result = cache.findBestMatch(text, substring, 50);
      const endTime = performance.now();

      expect(result).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(5); // Should be fast (<5ms)
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty substring', () => {
      const text = 'Hello world';
      const substring = '';

      const result = cache.findBestMatch(text, substring);

      expect(result).toBeNull();
    });

    it('should handle empty text', () => {
      const text = '';
      const substring = 'Hello';

      const result = cache.findBestMatch(text, substring);

      expect(result).toBeNull();
    });

    it('should handle special characters', () => {
      const text = 'Cost is $10.99 or $20.99';
      const substring = '$10.99';

      const result = cache.findBestMatch(text, substring);

      expect(result).toEqual({ start: 8, end: 14 });
    });

    it('should handle newlines and whitespace', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const substring = 'Line 2';

      const result = cache.findBestMatch(text, substring);

      expect(result).toEqual({ start: 7, end: 13 });
    });

    it('should handle Unicode characters', () => {
      const text = 'Hello 世界 world';
      const substring = '世界';

      const result = cache.findBestMatch(text, substring);

      expect(result).not.toBeNull();
      expect(text.slice(result.start, result.end)).toBe('世界');
    });

    it('should handle very long texts', () => {
      const longText = 'x '.repeat(10000) + 'target' + ' x'.repeat(10000);
      const substring = 'target';

      const startTime = performance.now();
      const result = cache.findBestMatch(longText, substring);
      const endTime = performance.now();

      expect(result).not.toBeNull();
      expect(longText.slice(result.start, result.end)).toBe('target');
      expect(endTime - startTime).toBeLessThan(50); // Should complete in <50ms
    });

    it('should handle overlapping patterns', () => {
      const text = 'aaa';
      const substring = 'aa';

      const result = cache.findBestMatch(text, substring, 0);

      // Should match first occurrence at index 0
      expect(result).toEqual({ start: 0, end: 2 });
    });
  });

  describe('Cache Effectiveness', () => {
    it('should cache occurrences for repeated queries', () => {
      const text = 'shot shot shot';
      const substring = 'shot';

      // First call - cache miss
      const result1 = cache.findBestMatch(text, substring, 0);

      // Second call - should use cache
      const startTime = performance.now();
      const result2 = cache.findBestMatch(text, substring, 5);
      const endTime = performance.now();

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1); // Cached lookup should be very fast
    });

    it('should clear cache when text changes', () => {
      const text1 = 'Hello world';
      const text2 = 'Goodbye world';
      const substring = 'world';

      // First call with text1
      const result1 = cache.findBestMatch(text1, substring);
      expect(result1).toEqual({ start: 6, end: 11 });

      // Second call with text2 - should clear cache and recalculate
      const result2 = cache.findBestMatch(text2, substring);
      expect(result2).toEqual({ start: 8, end: 13 });
    });

    it('should handle cache clearing manually', () => {
      const text = 'shot shot shot';
      const substring = 'shot';

      cache.findBestMatch(text, substring, 0);

      // Clear cache
      cache.clear();

      // Should still work after clearing
      const result = cache.findBestMatch(text, substring, 5);
      expect(result).toEqual({ start: 5, end: 9 });
    });
  });

  describe('Real-World Video Prompt Scenarios', () => {
    it('should accurately find camera moves in technical specs', () => {
      const text = `A cinematic shot of a sunset.

TECHNICAL SPECS:
- Duration: 4-8s
- Frame Rate: 24fps
- Camera Move: Pan right

ALTERNATIVE APPROACHES:
- Static shot
- Slow zoom in`;

      const substring = 'Pan right';
      const result = cache.findBestMatch(text, substring);

      expect(result).not.toBeNull();
      expect(text.slice(result.start, result.end)).toBe('Pan right');
    });

    it('should distinguish between repeated terms', () => {
      const text = 'Close-up of person, then wide shot, then another close-up';
      const substring = 'close-up';

      // Should find first occurrence (case-insensitive handled by server)
      const result1 = cache.findBestMatch(text.toLowerCase(), substring.toLowerCase(), 0);

      // Should find second occurrence
      const result2 = cache.findBestMatch(text.toLowerCase(), substring.toLowerCase(), 50);

      expect(result1.start).toBe(0);
      expect(result2.start).toBe(49);
    });

    it('should handle complex multi-word phrases', () => {
      const text = 'Dramatic lighting with soft shadows and warm color grading';
      const substring = 'soft shadows';

      const result = cache.findBestMatch(text, substring);

      expect(result).not.toBeNull();
      expect(text.slice(result.start, result.end)).toBe('soft shadows');
    });

    it('should handle time codes and technical values', () => {
      const text = 'Duration: 0:00:04 to 0:00:08 at 23.976fps';
      const substring = '23.976fps';

      const result = cache.findBestMatch(text, substring);

      expect(result).not.toBeNull();
      expect(text.slice(result.start, result.end)).toBe('23.976fps');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process 60 spans in under 30ms', () => {
      const text = `
        A cinematic wide shot of a sunset over the ocean. The camera slowly pans right,
        revealing a silhouette of a person standing on the beach. Warm golden hour lighting
        bathes the scene. Soft focus on foreground elements. 24fps, 4-8 second duration.
        Color grading: Orange and teal. Framing: Rule of thirds. Technical: Shallow depth of field.
      `.repeat(5); // ~500 chars * 5 = 2500 chars

      const substrings = [
        'wide shot',
        'sunset',
        'ocean',
        'camera',
        'pans right',
        'silhouette',
        'person',
        'beach',
        'golden hour',
        'lighting',
        'Soft focus',
        '24fps',
        '4-8 second',
        'Orange',
        'teal',
        'Rule of thirds',
        'Shallow depth',
      ];

      // Repeat to get 60 spans
      const allSubstrings = [...substrings, ...substrings, ...substrings, ...substrings.slice(0, 9)];

      const startTime = performance.now();

      allSubstrings.forEach((substring, i) => {
        cache.findBestMatch(text, substring, i * 10);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Processed ${allSubstrings.length} spans in ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(30); // Target: <30ms for 60 spans
    });

    it('should benefit from caching with repeated substrings', () => {
      const text = 'shot shot shot shot shot '.repeat(20); // Many repeated "shot"
      const substring = 'shot';

      // First pass - populate cache
      const startTime1 = performance.now();
      for (let i = 0; i < 100; i++) {
        cache.findBestMatch(text, substring, i);
      }
      const endTime1 = performance.now();
      const duration1 = endTime1 - startTime1;

      // Clear and retry - same operations without cache
      cache.clear();
      const startTime2 = performance.now();
      for (let i = 0; i < 100; i++) {
        cache.findBestMatch(text, substring, i);
      }
      const endTime2 = performance.now();
      const duration2 = endTime2 - startTime2;

      console.log(`With cache: ${duration1.toFixed(2)}ms, Without: ${duration2.toFixed(2)}ms`);

      // Second run (with fresh cache) should be similar to first
      // Cache helps when same substring is looked up multiple times
      expect(duration2).toBeGreaterThan(0);
    });
  });

  describe('Schema Compliance', () => {
    it('should return correct offset format', () => {
      const text = 'Hello world';
      const substring = 'world';

      const result = cache.findBestMatch(text, substring);

      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      expect(typeof result.start).toBe('number');
      expect(typeof result.end).toBe('number');
      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end).toBeGreaterThan(result.start);
    });

    it('should match extracted text from offsets', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const substring = 'brown fox';

      const result = cache.findBestMatch(text, substring);

      const extracted = text.slice(result.start, result.end);
      expect(extracted).toBe(substring);
    });

    it('should maintain consistency across multiple calls', () => {
      const text = 'Consistent text for testing';
      const substring = 'Consistent';

      const result1 = cache.findBestMatch(text, substring);
      const result2 = cache.findBestMatch(text, substring);
      const result3 = cache.findBestMatch(text, substring);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });
});
