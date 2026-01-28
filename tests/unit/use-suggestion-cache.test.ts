import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as fc from 'fast-check';

import {
  useSuggestionCache,
  type RawEnhancementSuggestionsResponse,
} from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionCache';

const baseSuggestionContext = {
  startIndex: 3,
  matchLength: 4,
  contextBefore: 'before',
  contextAfter: 'after',
  found: true,
  usedFallback: false,
};

describe('useSuggestionCache', () => {
  describe('error handling', () => {
    it('filters out invalid suggestion entries while preserving valid ones', () => {
      const { result } = renderHook(() => useSuggestionCache());

      const response: RawEnhancementSuggestionsResponse = {
        suggestions: [
          null,
          undefined,
          'First',
          42 as unknown as string,
          { text: 'Second', category: 'style' },
          {
            suggestions: ['Nested', { text: 'Nested Two', category: 'subject' }],
            category: 'camera',
          },
        ],
        isPlaceholder: false,
      };

      const normalized = result.current.setCachedSuggestions('cache-key', response);

      expect(normalized.suggestions).toEqual([
        { text: 'First' },
        { text: 'Second', category: 'style' },
        { text: 'Nested', category: 'camera' },
        { text: 'Nested Two', category: 'subject' },
      ]);
    });

    it('returns an empty suggestions list when none are provided', () => {
      const { result } = renderHook(() => useSuggestionCache());

      const normalized = result.current.setCachedSuggestions('empty-key', {
        suggestions: [],
        isPlaceholder: true,
      });

      expect(normalized.suggestions).toEqual([]);
      expect(normalized.isPlaceholder).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('normalizes category casing and whitespace in cache keys', () => {
      const { result } = renderHook(() => useSuggestionCache());

      const keyA = result.current.buildCacheKey({
        normalizedHighlight: 'highlight',
        normalizedPrompt: 'some prompt text',
        suggestionContext: baseSuggestionContext,
        category: ' Style ',
        spanFingerprint: null,
      });

      const keyB = result.current.buildCacheKey({
        normalizedHighlight: 'highlight',
        normalizedPrompt: 'some prompt text',
        suggestionContext: baseSuggestionContext,
        category: 'style',
        spanFingerprint: null,
      });

      expect(keyA).toBe(keyB);
    });

    it('returns null when no cached entry exists', () => {
      const { result } = renderHook(() => useSuggestionCache());

      expect(result.current.getCachedSuggestions('missing')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns the cached entry for subsequent lookups', () => {
      const { result } = renderHook(() => useSuggestionCache());
      const response: RawEnhancementSuggestionsResponse = {
        suggestions: [{ text: 'Cached' }],
        isPlaceholder: false,
      };

      result.current.setCachedSuggestions('cache-key', response);

      const cached = result.current.getCachedSuggestions('cache-key');

      expect(cached?.suggestions).toEqual([{ text: 'Cached' }]);
      expect(cached?.isPlaceholder).toBe(false);
    });

    it('produces stable cache keys for identical inputs', () => {
      const { result } = renderHook(() => useSuggestionCache());

      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (highlight, prompt, category, fingerprint) => {
            const key1 = result.current.buildCacheKey({
              normalizedHighlight: highlight,
              normalizedPrompt: prompt,
              suggestionContext: baseSuggestionContext,
              category,
              spanFingerprint: fingerprint,
            });

            const key2 = result.current.buildCacheKey({
              normalizedHighlight: highlight,
              normalizedPrompt: prompt,
              suggestionContext: baseSuggestionContext,
              category,
              spanFingerprint: fingerprint,
            });

            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
