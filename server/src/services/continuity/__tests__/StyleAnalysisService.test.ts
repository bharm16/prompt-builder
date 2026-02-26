import { describe, expect, it, vi } from 'vitest';
import { StyleAnalysisService } from '../StyleAnalysisService';

// Minimal mock for AIService — only `execute` is called
function buildMockAI(response: { text: string }) {
  return {
    execute: vi.fn().mockResolvedValue(response),
  } as unknown as Parameters<typeof StyleAnalysisService['prototype']['analyzeForDisplay']> extends never
    ? never
    : ConstructorParameters<typeof StyleAnalysisService>[0];
}

describe('StyleAnalysisService', () => {
  it('returns parsed metadata when LLM returns valid JSON', async () => {
    const ai = buildMockAI({
      text: JSON.stringify({
        colors: ['#ff0000', '#00ff00', '#0000ff'],
        lighting: 'Warm golden hour',
        mood: 'Serene',
        confidence: 0.92,
      }),
    });
    const service = new StyleAnalysisService(ai);

    const result = await service.analyzeForDisplay('https://example.com/img.png');

    expect(result).toEqual({
      dominantColors: ['#ff0000', '#00ff00', '#0000ff'],
      lightingDescription: 'Warm golden hour',
      moodDescription: 'Serene',
      confidence: 0.92,
    });

    expect(ai.execute).toHaveBeenCalledWith(
      'style_analysis',
      expect.objectContaining({
        jsonMode: true,
        temperature: 0.1,
      })
    );
  });

  it('fills defaults for missing optional fields', async () => {
    const ai = buildMockAI({
      text: JSON.stringify({}),
    });
    const service = new StyleAnalysisService(ai);

    const result = await service.analyzeForDisplay('https://example.com/img.png');

    expect(result.dominantColors).toEqual([]);
    expect(result.lightingDescription).toBe('Unknown');
    expect(result.moodDescription).toBe('Unknown');
    expect(result.confidence).toBe(0.5);
  });

  it('tolerates extra fields in LLM response via passthrough schema', async () => {
    const ai = buildMockAI({
      text: JSON.stringify({
        colors: ['blue'],
        lighting: 'Diffuse',
        mood: 'Calm',
        confidence: 0.8,
        extraField: 'should be ignored',
      }),
    });
    const service = new StyleAnalysisService(ai);

    const result = await service.analyzeForDisplay('https://example.com/img.png');

    expect(result.dominantColors).toEqual(['blue']);
    expect(result.confidence).toBe(0.8);
    // Extra field should not appear in output
    expect(result).not.toHaveProperty('extraField');
  });

  it('returns fallback metadata when LLM returns invalid JSON', async () => {
    const ai = buildMockAI({ text: 'not-json{]' });
    const service = new StyleAnalysisService(ai);

    const result = await service.analyzeForDisplay('https://example.com/img.png');

    expect(result).toEqual({
      dominantColors: [],
      lightingDescription: 'Unable to analyze',
      moodDescription: 'Unable to analyze',
      confidence: 0,
    });
  });

  it('returns fallback metadata when LLM call throws', async () => {
    const ai = {
      execute: vi.fn().mockRejectedValue(new Error('Rate limited')),
    } as unknown as ConstructorParameters<typeof StyleAnalysisService>[0];
    const service = new StyleAnalysisService(ai);

    const result = await service.analyzeForDisplay('https://example.com/img.png');

    expect(result).toEqual({
      dominantColors: [],
      lightingDescription: 'Unable to analyze',
      moodDescription: 'Unable to analyze',
      confidence: 0,
    });
  });

  it('passes image URL in the user message content', async () => {
    const ai = buildMockAI({
      text: JSON.stringify({ colors: [], confidence: 0.5 }),
    });
    const service = new StyleAnalysisService(ai);

    await service.analyzeForDisplay('https://example.com/test-image.jpg');

    const calls = (ai.execute as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const callArgs = calls[0]![1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userMessage = callArgs.messages[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(userMessage.role).toBe('user');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const imageContent = userMessage.content.find(
      (c: { type: string }) => c.type === 'image_url'
    ) as { image_url: { url: string } } | undefined;
    expect(imageContent?.image_url.url).toBe('https://example.com/test-image.jpg');
  });
});
