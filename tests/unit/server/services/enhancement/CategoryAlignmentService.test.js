import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryAlignmentService } from '../../../../../server/src/services/enhancement/CategoryAlignmentService.js';

describe('CategoryAlignmentService', () => {
  let service;
  let mockValidationService;

  beforeEach(() => {
    mockValidationService = {
      validateSuggestions: vi.fn((suggestions) => suggestions),
    };
    service = new CategoryAlignmentService(mockValidationService);
  });

  describe('enforceCategoryAlignment', () => {
    it('should return fallbacks when suggestions array is empty', () => {
      const params = {
        highlightedText: '24fps',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment([], params);

      expect(result.fallbackApplied).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.context.baseCategory).toBe('technical');
      expect(result.context.originalSuggestionsRejected).toBe(0);
      expect(result.context.reason).toBe('Category mismatch or low confidence');
    });

    it('should return fallbacks when suggestions has only one item', () => {
      const params = {
        highlightedText: 'dramatic lighting',
        highlightedCategory: 'lighting',
        highlightedCategoryConfidence: 0.8,
      };

      const suggestions = [{ text: 'soft light', category: 'lighting' }];

      const result = service.enforceCategoryAlignment(suggestions, params);

      expect(result.fallbackApplied).toBe(true);
      expect(result.context.originalSuggestionsRejected).toBe(1);
    });

    it('should return validated suggestions when enough valid suggestions exist', () => {
      const params = {
        highlightedText: 'medium shot',
        highlightedCategory: 'framing',
        highlightedCategoryConfidence: 0.9,
      };

      const suggestions = [
        { text: 'wide shot', category: 'framing' },
        { text: 'close-up', category: 'framing' },
        { text: 'extreme close-up', category: 'framing' },
      ];

      const result = service.enforceCategoryAlignment(suggestions, params);

      expect(result.fallbackApplied).toBe(false);
      expect(result.suggestions).toEqual(suggestions);
      expect(result.context.baseCategory).toBe('framing');
      expect(mockValidationService.validateSuggestions).toHaveBeenCalledWith(
        suggestions,
        'medium shot',
        'framing'
      );
    });

    it('should use fallbacks for null suggestions', () => {
      const params = {
        highlightedText: 'test',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(null, params);

      expect(result.fallbackApplied).toBe(true);
    });
  });

  describe('shouldUseFallback', () => {
    it('should return true when suggestions is null', () => {
      const result = service.shouldUseFallback(null, 'test', 'technical');
      expect(result).toBe(true);
    });

    it('should return true when suggestions is undefined', () => {
      const result = service.shouldUseFallback(undefined, 'test', 'technical');
      expect(result).toBe(true);
    });

    it('should return true when suggestions has less than 2 items', () => {
      const suggestions = [{ text: 'option 1' }];
      const result = service.shouldUseFallback(suggestions, 'test', 'technical');
      expect(result).toBe(true);
    });

    it('should return true when suggestions is empty array', () => {
      const result = service.shouldUseFallback([], 'test', 'technical');
      expect(result).toBe(true);
    });

    it('should return false when suggestions has 2 or more items without mismatches', () => {
      const suggestions = [
        { text: 'option 1', category: 'technical' },
        { text: 'option 2', category: 'technical' },
      ];
      const result = service.shouldUseFallback(suggestions, 'test', 'descriptive');
      expect(result).toBe(false);
    });

    describe('technical category with subcategories', () => {
      it('should return true when less than 50% of frameRate suggestions match pattern', () => {
        const suggestions = [
          { text: '24fps', category: 'technical' },
          { text: 'audio setting', category: 'technical' },
          { text: 'lighting value', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, '24fps', 'technical');

        expect(result).toBe(true);
      });

      it('should return false when 50% or more of frameRate suggestions match pattern', () => {
        const suggestions = [
          { text: '24fps', category: 'technical' },
          { text: '30fps', category: 'technical' },
          { text: '60fps', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, '24fps', 'technical');

        expect(result).toBe(false);
      });

      it('should return true for aspectRatio subcategory with mismatched suggestions', () => {
        const suggestions = [
          { text: '16:9', category: 'technical' },
          { text: 'frame rate', category: 'technical' },
          { text: 'lighting', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, '16:9', 'technical');

        expect(result).toBe(true);
      });

      it('should return false for aspectRatio subcategory with mostly valid suggestions', () => {
        const suggestions = [
          { text: '16:9', category: 'technical' },
          { text: '9:16', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, '16:9', 'technical');

        expect(result).toBe(false);
      });

      it('should return true for filmFormat subcategory with mismatched suggestions', () => {
        const suggestions = [
          { text: '35mm film', category: 'technical' },
          { text: 'audio quality', category: 'technical' },
          { text: 'color grading', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, '35mm', 'technical');

        expect(result).toBe(true);
      });
    });

    describe('audio detection in non-audio categories', () => {
      it('should return true when audio suggestions appear in technical category', () => {
        const suggestions = [
          { text: 'audio mixing', category: 'technical' },
          { text: '24fps', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, '24fps', 'technical');

        expect(result).toBe(true);
      });

      it('should return true when audio keywords appear in framing category', () => {
        const suggestions = [
          { text: 'wide shot', category: 'framing' },
          { text: 'background music', category: 'framing' },
        ];

        const result = service.shouldUseFallback(suggestions, 'wide shot', 'framing');

        expect(result).toBe(true);
      });

      it('should return true when sound/music/score appears in descriptive category', () => {
        const suggestions = [
          { text: 'film noir', category: 'descriptive' },
          { text: 'orchestral score', category: 'descriptive' },
        ];

        const result = service.shouldUseFallback(suggestions, 'noir', 'descriptive');

        expect(result).toBe(true);
      });

      it('should return true when category field contains audio in technical category', () => {
        const suggestions = [
          { text: 'suggestion 1', category: 'audio mixing' },
          { text: 'suggestion 2', category: 'technical' },
        ];

        const result = service.shouldUseFallback(suggestions, 'test', 'technical');

        expect(result).toBe(true);
      });

      it('should not trigger audio fallback for non-monitored categories', () => {
        const suggestions = [
          { text: 'audio mixing', category: 'lighting' },
          { text: 'soft light', category: 'lighting' },
        ];

        // lighting is not in the monitored list, but audio count > 0 would trigger fallback
        // This tests that only specific categories are checked
        const result = service.shouldUseFallback(suggestions, 'soft light', 'cameraMove');

        expect(result).toBe(false);
      });
    });

    describe('lighting detection in descriptive category', () => {
      it('should return true when more than 50% of suggestions are lighting-related', () => {
        const suggestions = [
          { text: 'dramatic lighting', category: 'descriptive' },
          { text: 'soft shadows', category: 'descriptive' },
          { text: 'glowing atmosphere', category: 'descriptive' },
        ];

        const result = service.shouldUseFallback(suggestions, 'noir style', 'descriptive');

        expect(result).toBe(true);
      });

      it('should return false when 50% or less suggestions are lighting-related', () => {
        const suggestions = [
          { text: 'film noir', category: 'descriptive' },
          { text: 'vintage aesthetic', category: 'descriptive' },
          { text: 'dramatic lighting', category: 'descriptive' },
        ];

        const result = service.shouldUseFallback(suggestions, 'noir style', 'descriptive');

        expect(result).toBe(false);
      });

      it('should detect lighting keywords: light, shadow, glow, illuminat', () => {
        const testCases = [
          { text: 'natural light' },
          { text: 'deep shadows' },
          { text: 'glowing edges' },
          { text: 'illuminated scene' },
        ];

        testCases.forEach((suggestion) => {
          const result = service.shouldUseFallback([suggestion, { text: 'filler' }], 'test', 'descriptive');
          expect(result).toBe(true);
        });
      });

      it('should detect lighting in category field', () => {
        const suggestions = [
          { text: 'suggestion', category: 'lighting setup' },
          { text: 'filler', category: 'descriptive' },
        ];

        const result = service.shouldUseFallback(suggestions, 'test', 'descriptive');

        expect(result).toBe(true);
      });
    });

    it('should be case-insensitive when detecting keywords', () => {
      const suggestions = [
        { text: 'AUDIO MIXING', category: 'technical' },
        { text: 'test', category: 'technical' },
      ];

      const result = service.shouldUseFallback(suggestions, 'test', 'technical');

      expect(result).toBe(true);
    });
  });

  describe('getCategoryFallbacks', () => {
    it('should return technical frameRate fallbacks for frameRate subcategory', () => {
      const fallbacks = service.getCategoryFallbacks('24fps', 'technical');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks[0]).toHaveProperty('text');
      expect(fallbacks[0]).toHaveProperty('category');
      expect(fallbacks[0]).toHaveProperty('explanation');
      expect(fallbacks.some(f => f.text.includes('fps'))).toBe(true);
    });

    it('should return technical aspectRatio fallbacks for aspectRatio subcategory', () => {
      const fallbacks = service.getCategoryFallbacks('16:9', 'technical');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.some(f => f.text.includes(':'))).toBe(true);
    });

    it('should return technical filmFormat fallbacks for filmFormat subcategory', () => {
      const fallbacks = service.getCategoryFallbacks('35mm', 'technical');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.some(f => f.text.includes('mm') || f.text.includes('film'))).toBe(true);
    });

    it('should return framing fallbacks for framing category', () => {
      const fallbacks = service.getCategoryFallbacks('wide shot', 'framing');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks.every(f => f.category === 'framing')).toBe(true);
    });

    it('should return cameraMove fallbacks for cameraMove category', () => {
      const fallbacks = service.getCategoryFallbacks('dolly shot', 'cameraMove');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks.every(f => f.category === 'cameraMove')).toBe(true);
    });

    it('should return lighting fallbacks for lighting category', () => {
      const fallbacks = service.getCategoryFallbacks('soft light', 'lighting');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks.every(f => f.category === 'lighting')).toBe(true);
    });

    it('should return descriptive fallbacks for descriptive category', () => {
      const fallbacks = service.getCategoryFallbacks('noir style', 'descriptive');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks.every(f => f.category === 'descriptive')).toBe(true);
    });

    it('should return generic fallbacks for unknown category', () => {
      const fallbacks = service.getCategoryFallbacks('test', 'unknownCategory');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBe(3);
      expect(fallbacks.every(f => f.category === 'unknownCategory')).toBe(true);
      expect(fallbacks[0].text).toBe('alternative option 1');
      expect(fallbacks[1].text).toBe('alternative option 2');
      expect(fallbacks[2].text).toBe('alternative option 3');
    });

    it('should return generic fallbacks for technical category without subcategory', () => {
      const fallbacks = service.getCategoryFallbacks('unknown technical', 'technical');

      expect(fallbacks).toBeDefined();
      expect(fallbacks.length).toBe(3);
      expect(fallbacks.every(f => f.category === 'technical')).toBe(true);
    });

    it('should return fallbacks that include explanation fields', () => {
      const fallbacks = service.getCategoryFallbacks('test', 'lighting');

      fallbacks.forEach(fallback => {
        expect(fallback).toHaveProperty('text');
        expect(fallback).toHaveProperty('category');
        expect(fallback).toHaveProperty('explanation');
        expect(typeof fallback.text).toBe('string');
        expect(typeof fallback.category).toBe('string');
        expect(typeof fallback.explanation).toBe('string');
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete flow with audio contamination in technical category', () => {
      const suggestions = [
        { text: 'audio quality', category: 'technical' },
        { text: 'sound mixing', category: 'technical' },
      ];

      const params = {
        highlightedText: '24fps',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(suggestions, params);

      expect(result.fallbackApplied).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.context.originalSuggestionsRejected).toBe(2);
    });

    it('should handle complete flow with lighting contamination in descriptive category', () => {
      const suggestions = [
        { text: 'dramatic lighting', category: 'descriptive' },
        { text: 'shadow play', category: 'descriptive' },
        { text: 'glowing atmosphere', category: 'descriptive' },
      ];

      const params = {
        highlightedText: 'noir style',
        highlightedCategory: 'descriptive',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(suggestions, params);

      expect(result.fallbackApplied).toBe(true);
      expect(result.context.reason).toBe('Category mismatch or low confidence');
    });

    it('should pass through valid suggestions without fallback', () => {
      const suggestions = [
        { text: 'wide shot', category: 'framing' },
        { text: 'medium shot', category: 'framing' },
        { text: 'close-up', category: 'framing' },
      ];

      const params = {
        highlightedText: 'wide shot',
        highlightedCategory: 'framing',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(suggestions, params);

      expect(result.fallbackApplied).toBe(false);
      expect(result.suggestions).toEqual(suggestions);
    });

    it('should properly detect frameRate subcategory and validate suggestions', () => {
      const validSuggestions = [
        { text: '24fps', category: 'technical' },
        { text: '30fps', category: 'technical' },
        { text: '60fps', category: 'technical' },
      ];

      const params = {
        highlightedText: '24fps',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(validSuggestions, params);

      expect(result.fallbackApplied).toBe(false);
    });

    it('should handle edge case of exactly 50% valid suggestions in technical category', () => {
      const suggestions = [
        { text: '24fps', category: 'technical' },
        { text: 'invalid', category: 'technical' },
      ];

      const params = {
        highlightedText: '24fps',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(suggestions, params);

      // 50% is not less than 50%, so should not use fallback
      expect(result.fallbackApplied).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty highlightedText gracefully', () => {
      const suggestions = [{ text: 'test' }, { text: 'test2' }];
      const params = {
        highlightedText: '',
        highlightedCategory: 'technical',
        highlightedCategoryConfidence: 0.9,
      };

      const result = service.enforceCategoryAlignment(suggestions, params);

      expect(result).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should handle suggestions with missing category field', () => {
      const suggestions = [
        { text: 'audio mixing' },
        { text: 'another suggestion' },
      ];

      const result = service.shouldUseFallback(suggestions, 'test', 'technical');

      expect(result).toBe(true);
    });

    it('should handle suggestions with only text field', () => {
      const suggestions = [
        { text: '24fps' },
        { text: '30fps' },
        { text: '60fps' },
      ];

      const result = service.shouldUseFallback(suggestions, '24fps', 'technical');

      expect(result).toBe(false);
    });

    it('should not mutate original suggestions array', () => {
      const suggestions = [
        { text: 'option 1', category: 'framing' },
        { text: 'option 2', category: 'framing' },
      ];

      const originalSuggestions = JSON.parse(JSON.stringify(suggestions));

      const params = {
        highlightedText: 'test',
        highlightedCategory: 'framing',
        highlightedCategoryConfidence: 0.9,
      };

      service.enforceCategoryAlignment(suggestions, params);

      expect(suggestions).toEqual(originalSuggestions);
    });
  });
});
