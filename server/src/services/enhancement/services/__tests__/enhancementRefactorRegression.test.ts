import { describe, expect, it, vi } from 'vitest';
import { SuggestionProcessingService } from '../SuggestionProcessingService';
import { detectPlaceholder } from '../placeholderDetection';
import type {
  Suggestion,
  GroupedSuggestions,
  EnhancementResult,
  ValidationService,
  DiversityEnforcer,
  CategoryAligner,
  AIService,
} from '../types';
import type { FallbackRegenerationService } from '../FallbackRegenerationService';

function createService(validationOverrides: Partial<ValidationService> = {}) {
  const diversityEnforcer: DiversityEnforcer = {
    ensureDiverseSuggestions: vi.fn(async (suggestions: Suggestion[]) => suggestions),
  };

  const validationService: ValidationService = {
    sanitizeSuggestions: vi.fn((suggestions: Suggestion[] | string[]) => suggestions as Suggestion[]),
    groupSuggestionsByCategory: vi.fn(() => []),
    ...validationOverrides,
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

  const ai = {} as AIService;

  return {
    service: new SuggestionProcessingService(
      diversityEnforcer,
      validationService,
      categoryAligner,
      fallbackRegeneration,
      ai
    ),
    validationService,
  };
}

describe('enhancement refactor regressions', () => {
  describe('SuggestionProcessingService moved methods', () => {
    it('applyDescriptorFallbacks passes through non-empty suggestions unchanged', () => {
      const { service } = createService();
      const suggestions: Suggestion[] = [{ text: 'keep me', category: 'style.aesthetic' }];

      const result = service.applyDescriptorFallbacks(suggestions, 'ignored', 'ignored');

      expect(result.suggestions).toEqual(suggestions);
      expect(result.usedFallback).toBe(false);
      expect(result.isDescriptorPhrase).toBe(false);
    });

    it('groupSuggestions delegates to validation grouping for placeholder suggestions', () => {
      const grouped: GroupedSuggestions[] = [
        {
          category: 'lighting',
          suggestions: [{ text: 'rim light', category: 'lighting.quality' }],
        },
      ];
      const groupSuggestionsByCategory = vi.fn(() => grouped);
      const { service } = createService({ groupSuggestionsByCategory });
      const suggestions: Suggestion[] = [{ text: 'rim light', category: 'lighting.quality' }];

      const result = service.groupSuggestions(suggestions, true);

      expect(groupSuggestionsByCategory).toHaveBeenCalledWith(suggestions);
      expect(result).toEqual(grouped);
    });

    it('buildResult preserves fallback and category metadata for grouped placeholders', () => {
      const { service } = createService();
      const groupedSuggestions: GroupedSuggestions[] = [
        {
          category: 'lighting',
          suggestions: [{ text: 'soft light', category: 'lighting.quality' }],
        },
      ];

      const result: EnhancementResult = service.buildResult({
        groupedSuggestions,
        isPlaceholder: true,
        phraseRole: 'lighting',
        activeConstraints: { mode: 'concise' },
        alignmentFallbackApplied: false,
        usedFallback: true,
        hasNoSuggestions: false,
      });

      expect(result.hasCategories).toBe(true);
      expect(result.fallbackApplied).toBe(true);
      expect(result.appliedConstraintMode).toBe('concise');
      expect(result.phraseRole).toBe('lighting');
    });
  });

  describe('detectPlaceholder function', () => {
    it('returns true for known placeholder keywords', () => {
      expect(detectPlaceholder('location', 'Set the scene in', '', 'Set the scene in location')).toBe(
        true
      );
    });

    it('avoids false positives for technical spec labels with colon context', () => {
      expect(detectPlaceholder('dutch angle', '**Camera:** ', '', '**Camera:** dutch angle')).toBe(
        false
      );
    });

    it('returns false for invalid highlighted text', () => {
      expect(detectPlaceholder('', '', '', '')).toBe(false);
      expect(detectPlaceholder(42 as unknown as string, '', '', '')).toBe(false);
    });
  });
});
