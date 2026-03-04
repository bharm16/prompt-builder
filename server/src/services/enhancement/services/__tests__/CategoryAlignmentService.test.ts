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
  it('applies fallback when category suggestions are mismatched', () => {
    const { service } = createService();

    const result = service.enforceCategoryAlignment(
      [
        { text: 'Ambient audio swells with strings', category: 'audio.soundtrack' },
        { text: 'Sound design pulses in sync', category: 'audio.sound-design' },
      ],
      {
        highlightedText: 'camera movement',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.95,
      }
    );

    expect(result.fallbackApplied).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.context.reason).toContain('Category mismatch');
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

  it('detects descriptive category mismatch when lighting dominates', () => {
    const { service } = createService();

    const needsFallback = service.shouldUseFallback(
      [
        { text: 'harsh key light and rim light', category: 'lighting.quality' },
        { text: 'deep shadows with blue glow', category: 'lighting.mood' },
        { text: 'golden sunlight with bright highlights', category: 'lighting.time' },
      ],
      'pensive expression',
      'descriptive',
      0.92
    );

    expect(needsFallback).toBe(true);
  });

  it('returns attribute-specific fallbacks for nested taxonomy categories', () => {
    const { service } = createService();

    const fallbacks = service.getCategoryFallbacks('cinematic', 'style.aesthetic');

    expect(fallbacks.length).toBeGreaterThan(0);
    expect(fallbacks.every((item) => item.category === 'style.aesthetic')).toBe(true);
    expect(fallbacks.some((item) => /alternative option/i.test(item.text))).toBe(false);
  });

  it('falls back to parent-category defaults when attribute-specific fallbacks are unavailable', () => {
    const { service } = createService();

    const fallbacks = service.getCategoryFallbacks('35mm lens', 'camera.lens');

    expect(fallbacks.length).toBeGreaterThan(0);
    expect(fallbacks.every((item) => item.category === 'camera.lens')).toBe(true);
    expect(fallbacks.some((item) => item.text.includes('50mm lens'))).toBe(true);
  });
});
