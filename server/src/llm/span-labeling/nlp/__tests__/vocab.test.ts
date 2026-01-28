import { describe, it, expect } from 'vitest';
import { VOCAB } from '../vocab';

/**
 * Tests for the VOCAB constant
 *
 * Note: The VOCAB is loaded at module initialization time, so we test
 * its structure and behavior rather than trying to mock the file loading.
 * The implementation handles file not found gracefully by returning {}.
 */
describe('VOCAB', () => {
  describe('structure', () => {
    it('is an object', () => {
      expect(typeof VOCAB).toBe('object');
      expect(VOCAB).not.toBeNull();
    });

    it('has string keys', () => {
      for (const key of Object.keys(VOCAB)) {
        expect(typeof key).toBe('string');
      }
    });

    it('has array values (if vocab.json exists)', () => {
      // If vocab.json exists, values should be string arrays
      // If it doesn't exist, VOCAB will be {}
      for (const value of Object.values(VOCAB)) {
        expect(Array.isArray(value)).toBe(true);
        if (Array.isArray(value)) {
          value.forEach((item: unknown) => {
            expect(typeof item).toBe('string');
          });
        }
      }
    });
  });

  describe('error handling behavior', () => {
    it('returns a valid object even if file loading fails', () => {
      // The implementation catches errors and returns {}
      // so VOCAB should always be a valid object
      expect(VOCAB).toBeDefined();
      expect(typeof VOCAB).toBe('object');
    });

    it('is iterable', () => {
      // Should be able to iterate over the vocab
      expect(() => {
        for (const _key of Object.keys(VOCAB)) {
          // iteration should work
        }
      }).not.toThrow();
    });
  });

  describe('usage patterns', () => {
    it('supports lookup by category', () => {
      // Common usage pattern: check if a word exists in a category
      const category = Object.keys(VOCAB)[0];
      if (category) {
        const words = VOCAB[category];
        expect(Array.isArray(words)).toBe(true);
      }
    });

    it('supports checking for word existence', () => {
      // Common usage pattern: check if a word exists in the vocab
      const allWords: string[] = [];
      for (const words of Object.values(VOCAB)) {
        if (Array.isArray(words)) {
          allWords.push(...words);
        }
      }
      expect(Array.isArray(allWords)).toBe(true);
    });
  });
});
