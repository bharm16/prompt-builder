import { describe, expect, it, vi } from 'vitest';
import { SuggestionProcessingService } from '../SuggestionProcessingService';
import type {
  Suggestion,
  ValidationService,
  DiversityEnforcer,
  CategoryAligner,
  AIService,
  FallbackRegenerationParams,
  OutputSchema,
} from '../types';
import type { FallbackRegenerationService } from '../FallbackRegenerationService';

function createService(options: {
  sanitizeImpl?: (suggestions: Suggestion[]) => Suggestion[];
  fallbackImpl?: (
    params: FallbackRegenerationParams
  ) => Promise<{
    suggestions: Suggestion[];
    usedFallback: boolean;
    sourceCount: number;
    constraints?: { mode?: string };
    rawCount?: number;
  }>;
} = {}): {
  service: SuggestionProcessingService;
  mocks: {
    attemptFallbackRegeneration: ReturnType<typeof vi.fn>;
    sanitizeSuggestions: ReturnType<typeof vi.fn>;
  };
} {
  const diversityEnforcer: DiversityEnforcer = {
    ensureDiverseSuggestions: vi.fn(async (suggestions: Suggestion[]) => suggestions),
  };

  const sanitizeSuggestions = vi.fn((suggestions: Suggestion[] | string[]) =>
    options.sanitizeImpl ? options.sanitizeImpl(suggestions as Suggestion[]) : (suggestions as Suggestion[])
  );
  const validationService: ValidationService = {
    sanitizeSuggestions,
    groupSuggestionsByCategory: vi.fn(() => []),
  };

  const categoryAligner: CategoryAligner = {
    enforceCategoryAlignment: vi.fn((suggestions: Suggestion[]) => ({
      suggestions,
      fallbackApplied: false,
      context: {},
    })),
  };

  const attemptFallbackRegeneration = vi.fn(
    options.fallbackImpl ||
      (async () => ({
        suggestions: [],
        usedFallback: false,
        sourceCount: 0,
      }))
  );

  const fallbackRegeneration: FallbackRegenerationService = {
    attemptFallbackRegeneration,
  } as unknown as FallbackRegenerationService;

  return {
    service: new SuggestionProcessingService(
      diversityEnforcer,
      validationService,
      categoryAligner,
      fallbackRegeneration,
      {} as AIService
    ),
    mocks: {
      attemptFallbackRegeneration,
      sanitizeSuggestions,
    },
  };
}

function buildProcessParams(
  overrides: Partial<Parameters<SuggestionProcessingService['processSuggestions']>[0]> = {}
) {
  return {
    suggestions: [
      { text: 'wide-angle shallow background blur', category: 'camera' },
      { text: 'selective focus on baby face', category: 'camera' },
    ],
    highlightedCategory: 'camera.focus',
    highlightedText: 'softly out of focus',
    highlightedCategoryConfidence: 0.95,
    isPlaceholder: false,
    isVideoPrompt: true,
    videoConstraints: { mode: 'micro', minWords: 2, maxWords: 8, maxSentences: 1 },
    phraseRole: 'camera description',
    highlightWordCount: 4,
    schema: {
      type: 'array',
      items: { required: ['text'] },
    } as OutputSchema,
    temperature: 0.6,
    contextBefore:
      'In the background, a sunny park setting with lush green trees ',
    contextAfter: ' in the breeze is softly out of focus.',
    fullPrompt:
      "The camera captures the baby while lush green trees sway in the breeze and the background is softly out of focus.",
    originalUserPrompt:
      "The camera captures the baby while lush green trees sway in the breeze and the background is softly out of focus.",
    brainstormContext: null,
    editHistory: [],
    modelTarget: null,
    promptSection: null,
    spanAnchors: '- subject: "lush green trees"',
    nearbySpanHints: '- environment: "breeze"',
    focusGuidance: ['Keep focus-specific language only'],
    lockedSpanCategories: ['shot.type'],
    skipDiversityCheck: false,
    ...overrides,
  };
}

describe('SuggestionProcessingService regression', () => {
  it('does not trigger descriptor fallback for short two-word descriptor fragments', () => {
    const { service } = createService();

    const result = service.applyDescriptorFallbacks([], "baby's face", 'A close-up of a baby in a car seat.');

    expect(result.usedFallback).toBe(false);
    expect(result.suggestions).toEqual([]);
  });

  it('filters adult-oriented descriptor fallbacks when child subjects are present', () => {
    const { service } = createService();

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

  it('attempts fallback top-up when strict sanitization yields fewer than three suggestions', async () => {
    const topUpSuggestion: Suggestion = {
      text: 'crisp foreground focus with soft bokeh',
      category: 'camera',
    };
    const { service, mocks } = createService({
      fallbackImpl: async (params) => {
        if (params.sanitizedSuggestions.length === 0) {
          return {
            suggestions: [topUpSuggestion],
            usedFallback: true,
            sourceCount: 1,
            constraints: { mode: 'phrase' },
          };
        }
        return {
          suggestions: params.sanitizedSuggestions,
          usedFallback: false,
          sourceCount: 0,
          constraints: { mode: 'micro' },
        };
      },
    });

    const result = await service.processSuggestions(
      buildProcessParams({
        suggestions: [
          { text: 'wide-angle shallow background blur', category: 'camera' },
          { text: 'selective focus on baby face', category: 'camera' },
        ],
      })
    );

    expect(mocks.attemptFallbackRegeneration).toHaveBeenCalledTimes(2);
    expect(result.suggestionsToUse.map((item) => item.text)).toEqual([
      'wide-angle shallow background blur',
      'selective focus on baby face',
      'crisp foreground focus with soft bokeh',
    ]);
  });

  it('recovers from empty micro-mode output by attempting an additional fallback pass', async () => {
    let sanitizeCallCount = 0;
    let fallbackCallCount = 0;
    const { service, mocks } = createService({
      sanitizeImpl: (suggestions) => {
        sanitizeCallCount += 1;
        return sanitizeCallCount === 1 ? [] : suggestions;
      },
      fallbackImpl: async () => {
        fallbackCallCount += 1;
        if (fallbackCallCount === 1) {
          return {
            suggestions: [],
            usedFallback: false,
            sourceCount: 0,
            constraints: { mode: 'micro' },
          };
        }
        return {
          suggestions: [{ text: 'shallow focus background blur', category: 'camera' }],
          usedFallback: true,
          sourceCount: 1,
          constraints: { mode: 'phrase' },
        };
      },
    });

    const result = await service.processSuggestions(buildProcessParams());

    expect(mocks.attemptFallbackRegeneration).toHaveBeenCalledTimes(2);
    expect(result.suggestionsToUse.map((item) => item.text)).toEqual([
      'shallow focus background blur',
    ]);
  });

  it('deduplicates and re-sanitizes merged fallback suggestions', async () => {
    const { service } = createService({
      sanitizeImpl: (suggestions) =>
        suggestions.filter((item) => item.text !== 'reject me'),
      fallbackImpl: async (params) => {
        if (params.sanitizedSuggestions.length === 0) {
          return {
            suggestions: [
              { text: 'selective focus on baby face', category: 'camera' },
              { text: 'crisp foreground focus with soft bokeh', category: 'camera' },
              { text: 'reject me', category: 'camera' },
            ],
            usedFallback: true,
            sourceCount: 3,
            constraints: { mode: 'phrase' },
          };
        }

        return {
          suggestions: params.sanitizedSuggestions,
          usedFallback: false,
          sourceCount: 0,
          constraints: { mode: 'micro' },
        };
      },
    });

    const result = await service.processSuggestions(
      buildProcessParams({
        suggestions: [
          { text: 'wide-angle shallow background blur', category: 'camera' },
          { text: 'selective focus on baby face', category: 'camera' },
        ],
      })
    );

    expect(result.suggestionsToUse.map((item) => item.text)).toEqual([
      'wide-angle shallow background blur',
      'selective focus on baby face',
      'crisp foreground focus with soft bokeh',
    ]);
  });
});
