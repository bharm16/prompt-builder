import { describe, expect, it, vi } from 'vitest';
import { CategoryAlignmentService } from '../CategoryAlignmentService';
import type { Suggestion } from '../types';

function createService(validateSuggestionsImpl?: (suggestions: Suggestion[]) => Suggestion[]) {
  const validationService = {
    validateSuggestions: vi.fn(
      validateSuggestionsImpl || ((suggestions: Suggestion[]) => suggestions)
    ),
  };

  return {
    service: new CategoryAlignmentService(validationService),
    validationService,
  };
}

describe('CategoryAlignmentService', () => {
  it('returns empty suggestions for LLM fallback when count is below threshold', () => {
    const { service } = createService();

    const result = service.enforceCategoryAlignment(
      [
        { text: 'Ambient audio swells with strings', category: 'audio.soundtrack' },
      ],
      {
        highlightedText: 'camera movement',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.95,
      }
    );

    expect(result.fallbackApplied).toBe(true);
    expect(result.suggestions).toEqual([]);
    expect(result.context.reason).toContain('Category mismatch');
    expect(result.context.originalSuggestionsRejected).toBe(0);
  });

  it('skips strict category validation when category confidence is low', () => {
    const inputSuggestions: Suggestion[] = [
      { text: 'Slow dolly push toward subject', category: 'camera.movement' },
      { text: 'Arc around the subject for reveal', category: 'camera.movement' },
    ];
    const { service, validationService } = createService();

    const result = service.enforceCategoryAlignment(inputSuggestions, {
      highlightedText: 'camera move',
      highlightedCategory: 'camera.movement',
      highlightedCategoryConfidence: 0.1,
    });

    expect(result.fallbackApplied).toBe(false);
    expect(result.suggestions).toEqual(inputSuggestions);
    expect(result.context.reason).toBe('Low category confidence');
    expect(validationService.validateSuggestions).not.toHaveBeenCalled();
  });

  it('shouldUseFallback returns true for empty suggestions', () => {
    const { service } = createService();
    expect(service.shouldUseFallback([], 'any text', 'camera', 0.9)).toBe(true);
  });

  it('shouldUseFallback returns true for fewer than 2 suggestions', () => {
    const { service } = createService();
    expect(
      service.shouldUseFallback(
        [{ text: 'only one', category: 'camera' }],
        'any text',
        'camera',
        0.9
      )
    ).toBe(true);
  });

  it('shouldUseFallback returns false for 2+ suggestions', () => {
    const { service } = createService((suggestions) => suggestions);
    expect(
      service.shouldUseFallback(
        [
          { text: 'suggestion A', category: 'camera' },
          { text: 'suggestion B', category: 'camera' },
        ],
        'any text',
        'camera',
        0.9
      )
    ).toBe(false);
  });

  it('shouldUseFallback returns true when validation removes category-drifted suggestions', () => {
    const { service, validationService } = createService((suggestions) =>
      suggestions.filter((suggestion) => suggestion.category === 'camera.angle')
    );

    expect(
      service.shouldUseFallback(
        [
          { text: 'low-angle shot', category: 'camera.angle' },
          { text: 'dolly in with 50mm lens', category: 'camera.movement' },
        ],
        'eye level',
        'camera.angle',
        0.95
      )
    ).toBe(true);
    expect(validationService.validateSuggestions).toHaveBeenCalled();
  });

  it('shouldUseFallback returns false when confidence is low (skips checks)', () => {
    const { service } = createService();
    expect(
      service.shouldUseFallback(
        [{ text: 'single suggestion', category: 'camera' }],
        'any text',
        'camera',
        0.2 // below MIN_CATEGORY_CONFIDENCE threshold
      )
    ).toBe(false);
  });

  it('passes only validated suggestions through when category has high confidence', () => {
    const inputSuggestions: Suggestion[] = [
      { text: 'Wide shot of cityscape', category: 'camera.framing' },
      { text: 'Medium close-up portrait', category: 'camera.framing' },
      { text: 'Extreme close-up on hands', category: 'camera.framing' },
    ];
    const { service, validationService } = createService((suggestions) =>
      suggestions.slice(0, 2)
    );

    const result = service.enforceCategoryAlignment(inputSuggestions, {
      highlightedText: 'wide shot',
      highlightedCategory: 'camera.framing',
      highlightedCategoryConfidence: 0.95,
    });

    expect(result.fallbackApplied).toBe(false);
    expect(validationService.validateSuggestions).toHaveBeenCalledWith(
      inputSuggestions,
      'wide shot',
      'camera.framing'
    );
    expect(result.suggestions).toEqual(inputSuggestions.slice(0, 2));
  });

  it('returns empty with metadata when zero suggestions exist', () => {
    const { service } = createService();

    const result = service.enforceCategoryAlignment([], {
      highlightedText: 'sunset glow',
      highlightedCategory: 'lighting.quality',
      highlightedCategoryConfidence: 0.85,
    });

    expect(result.fallbackApplied).toBe(true);
    expect(result.suggestions).toEqual([]);
    expect(result.context.baseCategory).toBe('lighting.quality');
  });
});
