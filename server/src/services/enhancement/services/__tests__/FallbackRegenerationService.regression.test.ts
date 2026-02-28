import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FallbackRegenerationService } from '../FallbackRegenerationService';
import type { Suggestion, VideoService, AIService } from '../types';

const mockEnforceJSON = vi.hoisted(() => vi.fn());

vi.mock('@utils/StructuredOutputEnforcer', () => ({
  StructuredOutputEnforcer: {
    enforceJSON: mockEnforceJSON,
  },
}));

describe('FallbackRegenerationService regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attempts fallback regeneration even when isVideoPrompt is false if sanitized output is empty', async () => {
    mockEnforceJSON.mockResolvedValue([{ text: 'gentle handheld drift' }]);

    const videoService = {
      getVideoFallbackConstraints: vi
        .fn()
        .mockReturnValueOnce({
          mode: 'concise',
          minWords: 2,
          maxWords: 12,
          maxSentences: 1,
        })
        .mockReturnValueOnce(null),
    } as unknown as VideoService;

    const promptBuilder = {
      buildRewritePrompt: vi.fn(() => 'rewrite prompt'),
    };

    const validationService = {
      sanitizeSuggestions: vi.fn((suggestions: Suggestion[]) => suggestions),
    };

    const diversityEnforcer = {
      ensureDiverseSuggestions: vi.fn(async (suggestions: Suggestion[]) => suggestions),
    };

    const service = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer
    );

    const result = await service.attemptFallbackRegeneration({
      sanitizedSuggestions: [],
      isVideoPrompt: false,
      isPlaceholder: false,
      regenerationDetails: {
        highlightWordCount: 2,
      },
      requestParams: {
        highlightedText: 'close-up framing',
        contextBefore: 'A baby sits quietly, ',
        contextAfter: ', as sunlight flickers.',
        fullPrompt: 'A baby sits quietly, close-up framing, as sunlight flickers.',
        originalUserPrompt: 'baby in car',
      },
      aiService: {} as AIService,
      schema: {
        type: 'array',
        items: { required: ['text'] },
      },
      temperature: 0.6,
    });

    expect(promptBuilder.buildRewritePrompt).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(true);
    expect(result.suggestions.map((item) => item.text)).toEqual(['gentle handheld drift']);
  });
});
