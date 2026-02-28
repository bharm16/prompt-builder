import { describe, expect, it, vi } from 'vitest';
import { EnhancementService } from '../EnhancementService';
import type {
  AIService,
  BrainstormBuilder,
  CategoryAligner,
  DiversityEnforcer,
  PromptBuilder,
  ValidationService,
  VideoService,
} from '../services/types';

function createService(): EnhancementService {
  const aiService = {} as AIService;
  const videoService = {
    isVideoPrompt: vi.fn(() => true),
    countWords: vi.fn((text: string) => text.trim().split(/\s+/).filter(Boolean).length),
    detectVideoPhraseRole: vi.fn(() => null),
    getVideoReplacementConstraints: vi.fn(() => ({ minWords: 2, maxWords: 12, maxSentences: 1 })),
    detectTargetModel: vi.fn(() => null),
    detectPromptSection: vi.fn(() => null),
    getCategoryFocusGuidance: vi.fn(() => null),
    getVideoFallbackConstraints: vi.fn(() => null),
  } as unknown as VideoService;

  const brainstormBuilder = {
    buildBrainstormSignature: vi.fn(() => null),
  } as unknown as BrainstormBuilder;

  const promptBuilder = {
    buildPlaceholderPrompt: vi.fn(() => 'placeholder'),
    buildRewritePrompt: vi.fn(() => 'rewrite'),
    buildCustomPrompt: vi.fn(() => 'custom'),
  } as unknown as PromptBuilder;

  const validationService = {
    sanitizeSuggestions: vi.fn(() => []),
    groupSuggestionsByCategory: vi.fn(() => []),
  } as unknown as ValidationService;

  const diversityEnforcer = {
    ensureDiverseSuggestions: vi.fn(async () => []),
  } as unknown as DiversityEnforcer;

  const categoryAligner = {
    enforceCategoryAlignment: vi.fn(() => ({
      suggestions: [],
      fallbackApplied: false,
      context: {},
    })),
  } as unknown as CategoryAligner;

  const cacheService = {
    getConfig: vi.fn(() => ({ ttl: 60, namespace: 'enhancement' })),
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    generateKey: vi.fn(() => 'key'),
  } as any;

  return new EnhancementService({
    aiService,
    videoService,
    brainstormBuilder,
    promptBuilder,
    validationService,
    diversityEnforcer,
    categoryAligner,
    cacheService,
  });
}

describe('EnhancementService regression', () => {
  it('splits prompt into clause boundaries for ownership-aware anchor selection', () => {
    const service = createService();
    const fullPrompt =
      'A baby sits in a car seat while trees sway gently in the wind and sunlight flickers.';

    const clauses = (service as any)._findClauseBoundaries(fullPrompt) as Array<{
      start: number;
      end: number;
    }>;

    expect(clauses.length).toBeGreaterThanOrEqual(2);
    const firstClause = fullPrompt.slice(clauses[0]!.start, clauses[0]!.end + 1).toLowerCase();
    const secondClause = fullPrompt
      .slice(clauses[1]!.start, clauses[1]!.end + 1)
      .toLowerCase();

    expect(firstClause).toContain('baby');
    expect(secondClause).toContain('trees');
  });

  it('prefers same-clause anchors over higher-confidence anchors from other clauses', () => {
    const service = createService();
    const fullPrompt =
      'A baby sits in a car seat while trees sway gently in the wind and sunlight flickers.';
    const babyStart = fullPrompt.indexOf('baby');
    const treesStart = fullPrompt.indexOf('trees');
    const swayStart = fullPrompt.indexOf('sway gently');

    const context = (service as any)._buildSpanContext({
      fullPrompt,
      highlightedText: 'sway gently',
      highlightedCategory: 'action.motion',
      phraseRole: 'action.motion',
      nearbySpans: [],
      allLabeledSpans: [
        {
          text: 'baby',
          role: 'subject',
          category: 'subject.identity',
          confidence: 0.99,
          start: babyStart,
          end: babyStart + 'baby'.length,
        },
        {
          text: 'trees',
          role: 'subject',
          category: 'subject.identity',
          confidence: 0.81,
          start: treesStart,
          end: treesStart + 'trees'.length,
        },
        {
          text: 'sway gently',
          role: 'action',
          category: 'action.motion',
          confidence: 0.92,
          start: swayStart,
          end: swayStart + 'sway gently'.length,
        },
      ],
    });

    expect(context.spanAnchors).toContain('subject: "trees"');
    expect(context.spanAnchors).not.toContain('subject: "baby"');
  });
});
