/**
 * Property-based tests for Suggestions State Synchronization
 *
 * Tests the following correctness property:
 * - Property 8: State Synchronization Preserves Category
 *
 * @module SuggestionsStateSync.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';

import { useSuggestionsState } from '@components/SuggestionsPanel/hooks/useSuggestionsState';
import type { SuggestionItem } from '@components/SuggestionsPanel/hooks/types';

/**
 * Helper to create a suggestion item with a category
 */
function createSuggestion(text: string, category: string): SuggestionItem {
  return { text, category };
}

/**
 * Helper to create a list of suggestions with categories
 */
function createSuggestionsWithCategories(
  categories: string[],
  suggestionsPerCategory: number = 2
): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];
  for (const category of categories) {
    for (let i = 0; i < suggestionsPerCategory; i++) {
      suggestions.push(createSuggestion(`${category}_suggestion_${i}`, category));
    }
  }
  return suggestions;
}

/**
 * Generate safe category names that won't conflict with JS prototype properties
 */
const safeCategoryArb = fc.string({ minLength: 1, maxLength: 20 }).map((s) => `cat_${s}`);

describe('Suggestions State Synchronization Property Tests', () => {
  /**
   * Property 8: State Synchronization Preserves Category
   *
   * For any prop change where the active category still exists in the new suggestions,
   * the active category SHALL be preserved. For any prop change where the active category
   * no longer exists, the hook SHALL fall back to the first available category.
   *
   * **Feature: ai-suggestions-fixes, Property 8: State Synchronization Preserves Category**
   * **Validates: Requirements 8.1, 8.2, 8.3**
   */
  describe('Property 8: State Synchronization Preserves Category', () => {
    it('preserves active category when it still exists in new suggestions', () => {
      fc.assert(
        fc.property(
          // Generate 2-5 unique category names with safe prefix
          fc.uniqueArray(safeCategoryArb, {
            minLength: 2,
            maxLength: 5,
          }),
          (categories) => {
            const initialSuggestions = createSuggestionsWithCategories(categories);

            const { result, rerender } = renderHook(
              ({ suggestions }) => useSuggestionsState(suggestions),
              { initialProps: { suggestions: initialSuggestions } }
            );

            // Get the initial active category (should be first category)
            const initialActiveCategory = result.current.activeCategory;
            expect(initialActiveCategory).toBe(categories[0]);

            // Change to a different category
            const targetCategory = categories[1];
            expect(targetCategory).toBeDefined();
            if (!targetCategory) {
              return;
            }
            act(() => {
              result.current.dispatch({
                type: result.current.actions.SET_ACTIVE_CATEGORY,
                payload: targetCategory,
              });
            });

            expect(result.current.activeCategory).toBe(targetCategory);

            // Create new suggestions that still include the target category
            const newSuggestions = createSuggestionsWithCategories(categories);

            // Rerender with new suggestions
            rerender({ suggestions: newSuggestions });

            // Active category should be preserved
            expect(result.current.activeCategory).toBe(targetCategory);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('falls back to first category when active category no longer exists', () => {
      fc.assert(
        fc.property(
          // Generate 3-5 unique category names with safe prefix
          fc.uniqueArray(safeCategoryArb, {
            minLength: 3,
            maxLength: 5,
          }),
          (categories) => {
            const initialSuggestions = createSuggestionsWithCategories(categories);

            const { result, rerender } = renderHook(
              ({ suggestions }) => useSuggestionsState(suggestions),
              { initialProps: { suggestions: initialSuggestions } }
            );

            // Change to the last category
            const targetCategory = categories[categories.length - 1];
            expect(targetCategory).toBeDefined();
            if (!targetCategory) {
              return;
            }
            act(() => {
              result.current.dispatch({
                type: result.current.actions.SET_ACTIVE_CATEGORY,
                payload: targetCategory,
              });
            });

            expect(result.current.activeCategory).toBe(targetCategory);

            // Create new suggestions WITHOUT the target category
            const remainingCategories = categories.slice(0, -1);
            const newSuggestions = createSuggestionsWithCategories(remainingCategories);

            // Rerender with new suggestions
            rerender({ suggestions: newSuggestions });

            // Active category should fall back to first available
            expect(result.current.activeCategory).toBe(remainingCategories[0]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('syncs internal state when suggestions prop changes', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(safeCategoryArb, {
            minLength: 1,
            maxLength: 3,
          }),
          fc.uniqueArray(safeCategoryArb, {
            minLength: 1,
            maxLength: 3,
          }),
          (categories1, categories2) => {
            const suggestions1 = createSuggestionsWithCategories(categories1);
            const suggestions2 = createSuggestionsWithCategories(categories2);

            const { result, rerender } = renderHook(
              ({ suggestions }) => useSuggestionsState(suggestions),
              { initialProps: { suggestions: suggestions1 } }
            );

            // Verify initial categories
            expect(result.current.categories.length).toBe(categories1.length);

            // Rerender with new suggestions
            rerender({ suggestions: suggestions2 });

            // Categories should reflect new suggestions
            expect(result.current.categories.length).toBe(categories2.length);
            expect(result.current.categories.map((c) => c.category).sort()).toEqual(
              categories2.sort()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles empty suggestions gracefully', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(safeCategoryArb, {
            minLength: 1,
            maxLength: 3,
          }),
          (categories) => {
            const initialSuggestions = createSuggestionsWithCategories(categories);

            const { result, rerender } = renderHook(
              ({ suggestions }) => useSuggestionsState(suggestions),
              { initialProps: { suggestions: initialSuggestions } }
            );

            // Verify initial state
            expect(result.current.activeCategory).toBe(categories[0]);

            // Rerender with empty suggestions
            rerender({ suggestions: [] });

            // Active category should be null when no suggestions
            expect(result.current.activeCategory).toBeNull();
            expect(result.current.categories.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('respects initialCategory when provided and exists', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(safeCategoryArb, {
            minLength: 2,
            maxLength: 5,
          }),
          (categories) => {
            const suggestions = createSuggestionsWithCategories(categories);
            const initialCategory = categories[1]; // Use second category as initial

            const { result } = renderHook(() =>
              useSuggestionsState(suggestions, initialCategory)
            );

            // Active category should be the initial category
            expect(result.current.activeCategory).toBe(initialCategory);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('falls back to first category when initialCategory does not exist', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(safeCategoryArb, {
            minLength: 2,
            maxLength: 5,
          }),
          safeCategoryArb,
          (categories, nonExistentCategory) => {
            // Ensure the non-existent category is actually not in the list
            fc.pre(!categories.includes(nonExistentCategory));

            const suggestions = createSuggestionsWithCategories(categories);

            const { result } = renderHook(() =>
              useSuggestionsState(suggestions, nonExistentCategory)
            );

            // Active category should fall back to first category
            expect(result.current.activeCategory).toBe(categories[0]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('currentSuggestions reflects active category', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(safeCategoryArb, {
            minLength: 2,
            maxLength: 4,
          }),
          fc.integer({ min: 1, max: 5 }),
          (categories, suggestionsPerCategory) => {
            const suggestions = createSuggestionsWithCategories(
              categories,
              suggestionsPerCategory
            );

            const { result } = renderHook(() => useSuggestionsState(suggestions));

            // Change to each category and verify currentSuggestions
            for (const category of categories) {
              act(() => {
                result.current.dispatch({
                  type: result.current.actions.SET_ACTIVE_CATEGORY,
                  payload: category,
                });
              });

              // Current suggestions should all belong to active category
              expect(result.current.currentSuggestions.length).toBe(suggestionsPerCategory);
              expect(
                result.current.currentSuggestions.every((s) => s.category === category)
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
