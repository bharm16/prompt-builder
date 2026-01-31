import { describe, it, expect } from 'vitest';
import { buildHighlightSuggestionPayload } from '@hooks/usePromptDebuggerUtils';

describe('buildHighlightSuggestionPayload', () => {
  describe('error and edge cases', () => {
    it('returns empty context when highlight text not found in prompt', () => {
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'a simple prompt', displayedPrompt: 'a simple prompt' },
        { text: 'NOT_PRESENT' },
      );
      expect(result.contextBefore).toBe('');
      expect(result.highlightedText).toBe('NOT_PRESENT');
    });

    it('uses empty string when all prompt fields are empty', () => {
      const result = buildHighlightSuggestionPayload({ inputPrompt: '' }, { text: 'x' });
      expect(result.fullPrompt).toBe('');
      expect(result.originalUserPrompt).toBe('');
    });

    it('converts null promptContext to null brainstormContext', () => {
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'test', promptContext: null },
        { text: 'test' },
      );
      expect(result.brainstormContext).toBeNull();
    });

    it('converts undefined promptContext to null brainstormContext', () => {
      const result = buildHighlightSuggestionPayload({ inputPrompt: 'test' }, { text: 'test' });
      expect(result.brainstormContext).toBeNull();
    });

    it('sets category and confidence to null when highlight lacks them', () => {
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'hello world', displayedPrompt: 'hello world' },
        { text: 'world' },
      );
      expect(result.highlightedCategory).toBeNull();
      expect(result.highlightedCategoryConfidence).toBeNull();
    });
  });

  describe('prompt resolution priority', () => {
    it('prefers displayedPrompt over optimizedPrompt', () => {
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'input', optimizedPrompt: 'optimized', displayedPrompt: 'displayed' },
        { text: 'displayed' },
      );
      expect(result.fullPrompt).toBe('displayed');
    });

    it('falls back to optimizedPrompt when displayedPrompt absent', () => {
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'input', optimizedPrompt: 'optimized' },
        { text: 'optimized' },
      );
      expect(result.fullPrompt).toBe('optimized');
    });

    it('falls back to inputPrompt when others absent', () => {
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'input only' },
        { text: 'input' },
      );
      expect(result.fullPrompt).toBe('input only');
    });
  });

  describe('context extraction', () => {
    it('extracts text before and after highlighted text', () => {
      const prompt = 'before the highlight after the end';
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: prompt, displayedPrompt: prompt },
        { text: 'highlight' },
      );
      expect(result.contextBefore).toBe('before the');
      expect(result.contextAfter).toContain('after the');
    });

    it('caps context at 300 characters each side', () => {
      const prompt = 'A'.repeat(400) + 'TARGET' + 'B'.repeat(400);
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: prompt, displayedPrompt: prompt },
        { text: 'TARGET' },
      );
      expect(result.contextBefore.length).toBeLessThanOrEqual(300);
      expect(result.contextAfter.length).toBeLessThanOrEqual(300);
    });
  });

  describe('core payload construction', () => {
    it('maps highlight and state fields correctly', () => {
      const result = buildHighlightSuggestionPayload(
        {
          inputPrompt: 'original input',
          displayedPrompt: 'A weathered cowboy walks through dust',
          promptContext: { style: 'cinematic' },
        },
        { text: 'cowboy', category: 'subject', confidence: 0.95 },
      );
      expect(result.highlightedText).toBe('cowboy');
      expect(result.highlightedPhrase).toBe('cowboy');
      expect(result.highlightedCategory).toBe('subject');
      expect(result.highlightedCategoryConfidence).toBe(0.95);
      expect(result.originalUserPrompt).toBe('original input');
      expect(result.brainstormContext).toEqual({ style: 'cinematic' });
    });

    it('invokes toJSON on promptContext when method exists', () => {
      const ctx = { toJSON: () => ({ serialized: true }) };
      const result = buildHighlightSuggestionPayload(
        { inputPrompt: 'test', displayedPrompt: 'test', promptContext: ctx as unknown as Record<string, unknown> },
        { text: 'test' },
      );
      expect(result.brainstormContext).toEqual({ serialized: true });
    });
  });
});
