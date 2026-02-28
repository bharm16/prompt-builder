import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuggestionGenerationService } from '../SuggestionGenerationService';
import { PROMPT_MODES } from '../../constants';
import type { AIService } from '../types';

const mockEnforceJSON = vi.hoisted(() => vi.fn());

vi.mock('@utils/StructuredOutputEnforcer', () => ({
  StructuredOutputEnforcer: {
    enforceJSON: mockEnforceJSON,
  },
}));

describe('SuggestionGenerationService regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries with Groq when qwen returns json_validate_failed', async () => {
    mockEnforceJSON
      .mockRejectedValueOnce(
        new Error('Groq API error: 400 - {"error":{"code":"json_validate_failed"}}')
      )
      .mockResolvedValueOnce([{ text: 'gentle tracking shot', category: 'camera.movement' }]);

    const contrastiveDiversity = {
      calculateDiversityMetrics: vi.fn(() => ({
        avgSimilarity: 0,
        minSimilarity: 0,
        maxSimilarity: 0,
        pairCount: 0,
      })),
      shouldUseContrastiveDecoding: vi.fn(() => false),
      generateWithContrastiveDecoding: vi.fn(async () => []),
    };

    const service = new SuggestionGenerationService(
      {} as AIService,
      contrastiveDiversity as never
    );

    const result = await service.generateSuggestions({
      systemPrompt: 'rewrite prompt',
      schema: { type: 'array', items: { required: ['text'] } },
      isVideoPrompt: true,
      isPlaceholder: false,
      highlightedText: 'driver seat',
      temperature: 0.6,
      metrics: {
        total: 0,
        cache: false,
        cacheCheck: 0,
        modelDetection: 0,
        sectionDetection: 0,
        promptBuild: 0,
        groqCall: 0,
        postProcessing: 0,
        promptMode: PROMPT_MODES.ENHANCEMENT,
      },
      provider: 'qwen',
    });

    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions?.[0]?.text).toBe('gentle tracking shot');
    expect(mockEnforceJSON).toHaveBeenCalledTimes(2);
    const firstCallOptions = mockEnforceJSON.mock.calls.at(0)?.[2] as
      | { provider?: string }
      | undefined;
    const secondCallOptions = mockEnforceJSON.mock.calls.at(1)?.[2] as
      | { provider?: string }
      | undefined;
    expect(firstCallOptions?.provider).toBe('qwen');
    expect(secondCallOptions?.provider).toBe('groq');
  });
});
