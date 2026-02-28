import { describe, expect, it, vi } from 'vitest';
import { SuggestionProcessingService } from '../SuggestionProcessingService';
import type {
  Suggestion,
  ValidationService,
  DiversityEnforcer,
  CategoryAligner,
  AIService,
} from '../types';
import type { FallbackRegenerationService } from '../FallbackRegenerationService';

function createService(): SuggestionProcessingService {
  const diversityEnforcer: DiversityEnforcer = {
    ensureDiverseSuggestions: vi.fn(async (suggestions: Suggestion[]) => suggestions),
  };

  const validationService: ValidationService = {
    sanitizeSuggestions: vi.fn((suggestions: Suggestion[] | string[]) => suggestions as Suggestion[]),
    groupSuggestionsByCategory: vi.fn(() => []),
  };

  const categoryAligner: CategoryAligner = {
    enforceCategoryAlignment: vi.fn((suggestions: Suggestion[]) => ({
      suggestions,
      fallbackApplied: false,
      context: {},
    })),
  };

  const fallbackRegeneration: FallbackRegenerationService = {
    attemptFallbackRegeneration: vi.fn(async () => ({
      suggestions: [],
      usedFallback: false,
      sourceCount: 0,
    })),
  } as unknown as FallbackRegenerationService;

  return new SuggestionProcessingService(
    diversityEnforcer,
    validationService,
    categoryAligner,
    fallbackRegeneration,
    {} as AIService
  );
}

describe('SuggestionProcessingService regression', () => {
  it('does not trigger descriptor fallback for short two-word descriptor fragments', () => {
    const service = createService();

    const result = service.applyDescriptorFallbacks([], "baby's face", 'A close-up of a baby in a car seat.');

    expect(result.usedFallback).toBe(false);
    expect(result.suggestions).toEqual([]);
  });

  it('filters adult-oriented descriptor fallbacks when child subjects are present', () => {
    const service = createService();

    const result = service.applyDescriptorFallbacks(
      [],
      'playfully gripping toy',
      'A baby in a car seat playfully gripping toy keys while sunlight flickers through the window.'
    );

    const suggestionTexts = result.suggestions.map((item) => item.text.toLowerCase());

    expect(result.usedFallback).toBe(true);
    expect(suggestionTexts.some((text) => text.includes('leather journal'))).toBe(false);
    expect(suggestionTexts.some((text) => text.includes('steel wrench'))).toBe(false);
    expect(suggestionTexts.some((text) => text.includes('wooden cane'))).toBe(false);
  });
});
