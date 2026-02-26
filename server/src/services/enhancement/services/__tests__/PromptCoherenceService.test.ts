import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptCoherenceService } from '../PromptCoherenceService';

const mockEnforceJSON = vi.hoisted(() => vi.fn());

vi.mock('@utils/StructuredOutputEnforcer', () => ({
  StructuredOutputEnforcer: {
    enforceJSON: mockEnforceJSON,
  },
}));

describe('PromptCoherenceService', () => {
  const aiService = {} as never;
  const service = new PromptCoherenceService(aiService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns conflicts when contradictory elements are detected', async () => {
    mockEnforceJSON.mockResolvedValue({
      conflicts: [
        {
          severity: 'medium',
          message: 'Potential day night conflict.',
          reasoning: 'Applied change introduced daylight while another span says night.',
          involvedSpanIds: ['span-1', 'span-2'],
          recommendations: [
            {
              title: 'Align night reference to daytime',
              rationale: 'Keep temporal consistency.',
              confidence: 0.8,
              edits: [
                {
                  type: 'replaceSpanText',
                  spanId: 'span-2',
                  replacementText: 'daytime boulevard',
                },
              ],
            },
          ],
        },
      ],
      harmonizations: [],
    });

    const result = await service.checkCoherence({
      beforePrompt: 'A runner at night in a city street.',
      afterPrompt: 'A runner in bright daylight on a city street at night.',
      appliedChange: {
        spanId: 'span-1',
        oldText: 'at night',
        newText: 'in bright daylight',
      },
      spans: [
        { id: 'span-1', text: 'in bright daylight', category: 'lighting.time' },
        { id: 'span-2', text: 'at night', category: 'lighting.time' },
      ],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.recommendations[0]?.edits[0]).toEqual(
      expect.objectContaining({
        type: 'replaceSpanText',
        spanId: 'span-2',
      })
    );
  });

  it('returns empty conflict/harmonization arrays for compatible prompts', async () => {
    mockEnforceJSON.mockResolvedValue({
      conflicts: [],
      harmonizations: [],
    });

    const result = await service.checkCoherence({
      beforePrompt: 'A runner at dusk on a city street.',
      afterPrompt: 'A runner at dusk on a city street with subtle fog.',
      appliedChange: {
        oldText: 'city street',
        newText: 'city street with subtle fog',
      },
      spans: [{ id: 'span-1', text: 'city street with subtle fog' }],
    });

    expect(result).toEqual({
      conflicts: [],
      harmonizations: [],
    });
  });

  it('returns empty results when llm check fails', async () => {
    mockEnforceJSON.mockRejectedValue(new Error('model unavailable'));

    const result = await service.checkCoherence({
      beforePrompt: 'A runner at dawn.',
      afterPrompt: 'A runner at dawn with rain.',
      spans: [{ id: 'span-1', text: 'at dawn' }],
    });

    expect(result).toEqual({
      conflicts: [],
      harmonizations: [],
    });
  });

  it('sanitizes invalid span ids and preserves anchor-quote edits', async () => {
    mockEnforceJSON.mockResolvedValue({
      conflicts: [
        {
          severity: 'low',
          message: 'Potential mismatch.',
          reasoning: 'One edit references an unknown span id.',
          involvedSpanIds: ['span-1', 'span-missing'],
          recommendations: [
            {
              title: 'Fix unknown span with anchor',
              rationale: 'Anchor quote can still target text safely.',
              edits: [
                {
                  type: 'replaceSpanText',
                  spanId: 'span-missing',
                  anchorQuote: 'city skyline at night',
                  replacementText: 'city skyline at dusk',
                },
              ],
            },
            {
              title: 'Drop invalid unanchored edit',
              rationale: 'No valid span or anchor.',
              edits: [
                {
                  type: 'removeSpan',
                  spanId: 'span-missing',
                },
              ],
            },
          ],
        },
      ],
      harmonizations: [],
    });

    const result = await service.checkCoherence({
      beforePrompt: 'A runner on a city skyline at night.',
      afterPrompt: 'A runner on a city skyline at night with soft haze.',
      spans: [{ id: 'span-1', text: 'runner', category: 'subject.identity' }],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.involvedSpanIds).toEqual(['span-1']);
    expect(result.conflicts[0]?.recommendations).toHaveLength(1);
    expect(result.conflicts[0]?.recommendations[0]?.edits[0]).toEqual(
      expect.objectContaining({
        type: 'replaceSpanText',
        anchorQuote: 'city skyline at night',
      })
    );
  });
});
