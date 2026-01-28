import { describe, expect, it, vi } from 'vitest';

const mockCallModel = vi.fn();
const mockDetectCapabilities = vi.fn();

vi.mock('@llm/span-labeling/services/robust-llm-client/modelInvocation', () => ({
  callModel: (...args: unknown[]) => mockCallModel(...args),
}));

vi.mock('@utils/provider/ProviderDetector', () => ({
  detectAndGetCapabilities: (...args: unknown[]) => mockDetectCapabilities(...args),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('twoPassExtraction', () => {
  it('runs two passes and returns structured response', async () => {
    mockDetectCapabilities.mockReturnValue({ capabilities: { developerRole: true } });
    mockCallModel
      .mockResolvedValueOnce({ text: 'analysis', metadata: {} })
      .mockResolvedValueOnce({ text: 'structured', metadata: {} });

    const { twoPassExtraction } = await import('@llm/span-labeling/services/robust-llm-client/twoPassExtraction');

    const response = await twoPassExtraction({
      systemPrompt: 'SYS',
      userPayload: JSON.stringify({ text: 'hello', policy: {}, templateVersion: 'v1' }),
      aiService: { execute: vi.fn() } as never,
      maxTokens: 100,
      providerOptions: { enableBookending: false, useFewShot: false, useSeedFromConfig: false, enableLogprobs: false },
      providerName: 'openai',
    });

    expect(response.text).toBe('structured');
    const secondCall = mockCallModel.mock.calls[1]?.[0] as { providerOptions?: { developerMessage?: string } };
    expect(secondCall.providerOptions?.developerMessage).toContain('STRUCTURING MODE');
  });
});
