import { describe, it, expect, vi, beforeEach } from 'vitest';
import { twoPassExtraction } from '../twoPassExtraction';

const mockDetectCapabilities = vi.fn();
const mockCallModel = vi.fn();

vi.mock('@utils/provider/ProviderDetector', () => ({
  detectAndGetCapabilities: (...args: unknown[]) => mockDetectCapabilities(...args),
}));

vi.mock('../modelInvocation', () => ({
  callModel: (...args: unknown[]) => mockCallModel(...args),
}));

describe('twoPassExtraction', () => {
  beforeEach(() => {
    mockDetectCapabilities.mockReset();
    mockCallModel.mockReset();
  });

  describe('edge cases', () => {
    it('omits developer message when developerRole is unavailable', async () => {
      mockDetectCapabilities.mockReturnValue({ capabilities: { developerRole: false } });
      mockCallModel.mockResolvedValueOnce({ text: 'analysis', metadata: {} });
      mockCallModel.mockResolvedValueOnce({ text: 'structured', metadata: {} });

      await twoPassExtraction({
        systemPrompt: 'sys',
        userPayload: '{"text":"hello","policy":{},"templateVersion":"v1"}',
        aiService: {} as unknown as any,
        maxTokens: 1000,
        providerOptions: {
          enableBookending: true,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: false,
        },
        providerName: 'openai',
      });

      const secondCallArgs = mockCallModel.mock.calls[1]?.[0] as { providerOptions?: { developerMessage?: string } };
      expect(secondCallArgs.providerOptions?.developerMessage).toBeUndefined();
    });
  });

  describe('core behavior', () => {
    it('passes developer message when developerRole is available', async () => {
      mockDetectCapabilities.mockReturnValue({ capabilities: { developerRole: true } });
      mockCallModel.mockResolvedValueOnce({ text: 'analysis', metadata: {} });
      mockCallModel.mockResolvedValueOnce({ text: 'structured', metadata: { provider: 'test' } });

      const result = await twoPassExtraction({
        systemPrompt: 'sys',
        userPayload: '{"text":"hello","policy":{},"templateVersion":"v1"}',
        aiService: {} as unknown as any,
        maxTokens: 1000,
        providerOptions: {
          enableBookending: true,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: false,
        },
        providerName: 'openai',
      });

      const secondCallArgs = mockCallModel.mock.calls[1]?.[0] as { providerOptions?: { developerMessage?: string } };
      expect(secondCallArgs.providerOptions?.developerMessage).toContain('analysis');
      expect(result.metadata?.provider).toBe('test');
    });
  });
});
