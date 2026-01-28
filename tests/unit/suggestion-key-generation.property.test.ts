/**
 * Property-based tests for Suggestion Key Generation
 *
 * Tests the following correctness property:
 * - Property 7: Fallback Key Generation Determinism
 *
 * @module SuggestionKeyGeneration.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { generateSuggestionKey } from '@components/SuggestionsPanel/components/SuggestionsList';
import type { SuggestionItem } from '@components/SuggestionsPanel/hooks/types';

describe('Suggestion Key Generation Property Tests', () => {
  /**
   * Property 7: Fallback Key Generation Determinism
   *
   * For any suggestion without a backend ID, the generated key SHALL be deterministic
   * (same text + index = same key) and unique within the list (different index = different
   * key even for same text).
   *
   * **Feature: ai-suggestions-fixes, Property 7: Fallback Key Generation Determinism**
   * **Validates: Requirements 7.3**
   */
  describe('Property 7: Fallback Key Generation Determinism', () => {
    it('same text and index produces same key (determinism)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.integer({ min: 0, max: 1000 }),
          (text, index) => {
            const suggestion: SuggestionItem = { text };

            const key1 = generateSuggestionKey(suggestion, index);
            const key2 = generateSuggestionKey(suggestion, index);

            // Same text + index must produce same key
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different indices produce different keys for same text (uniqueness within list)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 0, max: 500 }),
          (text, index1, index2) => {
            // Skip if indices are the same
            fc.pre(index1 !== index2);

            const suggestion: SuggestionItem = { text };

            const key1 = generateSuggestionKey(suggestion, index1);
            const key2 = generateSuggestionKey(suggestion, index2);

            // Different indices must produce different keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('backend ID is used when available (takes precedence)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.integer({ min: 0, max: 1000 }),
          (id, text, index) => {
            const suggestion: SuggestionItem = { id, text };

            const key = generateSuggestionKey(suggestion, index);

            // When ID is present, it should be used as the key
            expect(key).toBe(id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('backend ID is consistent regardless of index', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 0, max: 500 }),
          (id, text, index1, index2) => {
            const suggestion: SuggestionItem = { id, text };

            const key1 = generateSuggestionKey(suggestion, index1);
            const key2 = generateSuggestionKey(suggestion, index2);

            // Backend ID should be used regardless of index
            expect(key1).toBe(id);
            expect(key2).toBe(id);
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fallback key format is consistent', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.integer({ min: 0, max: 1000 }),
          (text, index) => {
            const suggestion: SuggestionItem = { text };

            const key = generateSuggestionKey(suggestion, index);

            // Fallback key should start with 'suggestion_' prefix
            expect(key).toMatch(/^suggestion_/);
            // Fallback key should end with the index
            expect(key).toMatch(new RegExp(`_${index}$`));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles empty text gracefully', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (index) => {
          const suggestion: SuggestionItem = { text: '' };

          const key = generateSuggestionKey(suggestion, index);

          // Should produce a valid key even with empty text
          expect(key).toBeTruthy();
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('handles undefined text gracefully', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (index) => {
          const suggestion: SuggestionItem = {};

          const key = generateSuggestionKey(suggestion, index);

          // Should produce a valid key even with undefined text
          expect(key).toBeTruthy();
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('all keys in a list are unique', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 1, maxLength: 20 }),
          (texts) => {
            const suggestions: SuggestionItem[] = texts.map((text) => ({ text }));

            const keys = suggestions.map((suggestion, index) =>
              generateSuggestionKey(suggestion, index)
            );

            // All keys should be unique
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
