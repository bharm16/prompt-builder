/**
 * Unit tests for suggestionPayload
 */

import { describe, expect, it } from 'vitest';

import { buildEnhancementSuggestionPayload } from '@components/PromptEnhancementEditor/utils/suggestionPayload';
import type { HighlightMetadata } from '@components/PromptEnhancementEditor/types';

describe('buildEnhancementSuggestionPayload', () => {
  describe('error handling', () => {
    it('handles missing metadata without throwing', () => {
      const payload = buildEnhancementSuggestionPayload(
        'highlight',
        'Before highlight after',
        undefined,
        null
      );

      expect(payload.highlightedCategory).toBeNull();
      expect(payload.highlightedCategoryConfidence).toBeNull();
      expect(payload.highlightedPhrase).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('normalizes category and clamps confidence to valid range', () => {
      const metadata: HighlightMetadata = {
        category: '  tone  ',
        phrase: 'warm',
        confidence: 1.5,
      };

      const payload = buildEnhancementSuggestionPayload(
        'warm light',
        'Before warm light after',
        undefined,
        metadata
      );

      expect(payload.highlightedCategory).toBe('tone');
      expect(payload.highlightedCategoryConfidence).toBe(1);
    });

    it('includes originalUserPrompt only when provided', () => {
      const payload = buildEnhancementSuggestionPayload(
        'focus',
        'Before focus after',
        'Original prompt',
        null
      );

      expect(payload.originalUserPrompt).toBe('Original prompt');

      const withoutOriginal = buildEnhancementSuggestionPayload(
        'focus',
        'Before focus after',
        undefined,
        null
      );

      expect('originalUserPrompt' in withoutOriginal).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('captures surrounding context for the highlighted text', () => {
      const payload = buildEnhancementSuggestionPayload(
        'highlight',
        'Before highlight after',
        undefined,
        null
      );

      expect(payload.contextBefore).toBe('Before');
      expect(payload.contextAfter).toBe('after');
      expect(payload.fullPrompt).toBe('Before highlight after');
      expect(payload.highlightedText).toBe('highlight');
    });
  });
});
