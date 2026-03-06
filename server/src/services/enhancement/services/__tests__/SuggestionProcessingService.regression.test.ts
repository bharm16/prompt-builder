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
    filterOriginalEchoes: vi.fn((suggestions: Suggestion[]) => suggestions),
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
      (async (params: FallbackRegenerationParams) => ({
        suggestions: params.sanitizedSuggestions,
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
  it('sends empty to FallbackRegenerationService when sanitization removes all model output', async () => {
    let sanitizeCallCount = 0;
    const { service, mocks } = createService({
      sanitizeImpl: (suggestions) => {
        sanitizeCallCount += 1;
        return sanitizeCallCount === 1 ? [] : suggestions;
      },
      fallbackImpl: async () => ({
        suggestions: [
          { text: 'shallow depth of field bokeh', category: 'camera.focus' },
          { text: 'selective focus on foreground subject', category: 'camera.focus' },
          { text: 'soft background defocus separation', category: 'camera.focus' },
        ],
        usedFallback: true,
        sourceCount: 3,
        constraints: { mode: 'micro' },
      }),
    });

    const result = await service.processSuggestions(buildProcessParams());

    // Verify empty suggestions go to LLM fallback (not static seeding)
    expect(mocks.attemptFallbackRegeneration).toHaveBeenCalledTimes(1);
    expect(mocks.attemptFallbackRegeneration.mock.calls[0]?.[0]?.sanitizedSuggestions).toHaveLength(0);
    expect(result.suggestionsToUse.length).toBe(3);
    expect(result.usedFallback).toBe(true);
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

    expect(mocks.attemptFallbackRegeneration.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.suggestionsToUse.map((item: Suggestion) => item.text)).toEqual([
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

    expect(mocks.attemptFallbackRegeneration.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.suggestionsToUse.map((item: Suggestion) => item.text)).toEqual([
      'shallow focus background blur',
    ]);
  });

  it('deduplicates and re-sanitizes merged fallback suggestions', async () => {
    const { service } = createService({
      sanitizeImpl: (suggestions) =>
        suggestions.filter((item: Suggestion) => item.text !== 'reject me'),
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

    expect(result.suggestionsToUse.map((item: Suggestion) => item.text)).toEqual([
      'wide-angle shallow background blur',
      'selective focus on baby face',
      'crisp foreground focus with soft bokeh',
    ]);
  });

  it('continues fallback top-up until minimum recoverable target is met', async () => {
    let fallbackCallCount = 0;
    const { service, mocks } = createService({
      fallbackImpl: async (params) => {
        fallbackCallCount += 1;

        // Initial pass: existing strict suggestion survives, no fallback used.
        if (fallbackCallCount === 1) {
          return {
            suggestions: params.sanitizedSuggestions,
            usedFallback: false,
            sourceCount: 0,
            constraints: { mode: 'micro' },
          };
        }

        // First top-up pass: only one additional valid suggestion.
        if (fallbackCallCount === 2) {
          return {
            suggestions: [
              { text: 'wide-angle shallow background blur', category: 'camera' },
              { text: 'crisp foreground focus with soft bokeh', category: 'camera' },
            ],
            usedFallback: true,
            sourceCount: 2,
            constraints: { mode: 'phrase' },
          };
        }

        // Second top-up pass: provide a third unique suggestion.
        return {
          suggestions: [
            { text: 'wide-angle shallow background blur', category: 'camera' },
            { text: 'crisp foreground focus with soft bokeh', category: 'camera' },
            { text: 'selective rack focus onto foreground subject', category: 'camera' },
          ],
          usedFallback: true,
          sourceCount: 3,
          constraints: { mode: 'micro' },
        };
      },
    });

    const result = await service.processSuggestions(
      buildProcessParams({
        suggestions: [{ text: 'wide-angle shallow background blur', category: 'camera' }],
      })
    );

    expect(mocks.attemptFallbackRegeneration).toHaveBeenCalledTimes(3);
    expect(result.suggestionsToUse.map((item: Suggestion) => item.text)).toEqual([
      'wide-angle shallow background blur',
      'crisp foreground focus with soft bokeh',
      'selective rack focus onto foreground subject',
    ]);
  });

  it('returns empty suggestionsToUse with no static strings when all AI paths fail', async () => {
    const { service } = createService({
      sanitizeImpl: () => [],
      fallbackImpl: async () => ({
        suggestions: [],
        usedFallback: false,
        sourceCount: 0,
      }),
    });

    const result = await service.processSuggestions(buildProcessParams());

    expect(result.suggestionsToUse).toEqual([]);
    expect(result.usedFallback).toBe(false);
  });
});
