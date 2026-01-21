import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { VideoToImagePromptTransformer } from '../VideoToImagePromptTransformer';
import { LLMClient } from '@clients/LLMClient';
import type { AIResponse } from '@interfaces/IAIClient';

const buildResponse = (text: string): AIResponse => ({
  text,
  metadata: {},
});

const createClient = () => {
  const completeMock: MockedFunction<
    (systemPrompt: string, options?: Record<string, unknown>) => Promise<AIResponse>
  > = vi.fn();

  const adapter = {
    complete: completeMock,
  };

  const client = new LLMClient({
    adapter,
    providerName: 'test-llm',
    defaultTimeout: 1000,
  });

  return { client, completeMock };
};

describe('VideoToImagePromptTransformer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns the original prompt when the LLM call fails', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockRejectedValueOnce(new Error('LLM down'));

      const transformer = new VideoToImagePromptTransformer({ llmClient: client });
      const result = await transformer.transform('A slow pan over mountains');

      expect(result).toBe('A slow pan over mountains');
    });

    it('returns the initial transformation if the repair pass fails', async () => {
      const { client, completeMock } = createClient();
      completeMock
        .mockResolvedValueOnce(buildResponse('A dog in a park with sunlight.'))
        .mockRejectedValueOnce(new Error('repair failed'));

      const transformer = new VideoToImagePromptTransformer({ llmClient: client });
      const result = await transformer.transform(
        'Wide shot, eye level, 50mm lens of a dog playing in a park.'
      );

      expect(result).toBe('A dog in a park with sunlight.');
      expect(completeMock).toHaveBeenCalledTimes(2);
    });

    it('keeps the original prompt if the transformation is too short', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockResolvedValueOnce(buildResponse('short'));

      const transformer = new VideoToImagePromptTransformer({ llmClient: client });
      const result = await transformer.transform('A cinematic over-the-shoulder shot');

      expect(result).toBe('A cinematic over-the-shoulder shot');
    });
  });

  describe('edge cases', () => {
    it('returns empty strings without calling the LLM', async () => {
      const { client, completeMock } = createClient();
      const transformer = new VideoToImagePromptTransformer({ llmClient: client });

      const result = await transformer.transform('   ');

      expect(result).toBe('');
      expect(completeMock).not.toHaveBeenCalled();
    });

    it('front-loads camera cues already present in the LLM response', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockResolvedValueOnce(
        buildResponse('A bowl of ramen on a table, close-up, top-down overhead.')
      );

      const transformer = new VideoToImagePromptTransformer({ llmClient: client });
      const result = await transformer.transform('Close-up top-down overhead of ramen.');

      expect(result.startsWith('close-up, top-down overhead')).toBe(true);
      expect(result).toContain('bowl of ramen');
    });
  });

  describe('core behavior', () => {
    it('repairs transformations to include required camera cues', async () => {
      const { client, completeMock } = createClient();
      completeMock
        .mockResolvedValueOnce(buildResponse('A cyclist riding through the city in golden light.'))
        .mockResolvedValueOnce(
          buildResponse(
            'Wide shot, eye-level, 50mm lens, a cyclist riding through the city in golden light.'
          )
        );

      const transformer = new VideoToImagePromptTransformer({ llmClient: client });
      const result = await transformer.transform(
        'Wide shot, eye level, 50mm lens of a cyclist riding through the city.'
      );

      expect(result.startsWith('wide shot, eye-level, 50mm lens')).toBe(true);
      expect(result).toContain('cyclist riding through the city');
    });

    it('keeps transformed text when camera cues are preserved', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockResolvedValueOnce(
        buildResponse('Wide shot, eye-level, 50mm lens, a calm forest clearing.')
      );

      const transformer = new VideoToImagePromptTransformer({ llmClient: client });
      const result = await transformer.transform(
        'Wide shot, eye level, 50mm lens on a calm forest clearing.'
      );

      expect(result).toBe('wide shot, eye-level, 50mm lens, a calm forest clearing.');
    });
  });
});
