import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryboardPreviewService } from '../StoryboardPreviewService';
import { STORYBOARD_FRAME_COUNT, BASE_PROVIDER, EDIT_PROVIDER } from '../constants';
import { buildEditPrompt } from '../prompts';
import { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import { StoryboardFramePlanner } from '../StoryboardFramePlanner';
import { LLMClient } from '@clients/LLMClient';
import type { ImageAssetStore } from '@services/image-generation/storage/types';
import type { AIResponse } from '@interfaces/IAIClient';

const createServices = () => {
  const assetStore: ImageAssetStore = {
    storeFromUrl: vi.fn(),
    storeFromBuffer: vi.fn(),
    getPublicUrl: vi.fn(),
    exists: vi.fn(),
    cleanupExpired: vi.fn(),
  };

  const imageGenerationService = new ImageGenerationService({
    providers: [],
    assetStore,
    skipStorage: true,
  });
  const generatePreview = vi.spyOn(imageGenerationService, 'generatePreview');

  const adapter = {
    complete: vi.fn<Promise<AIResponse>, [string, Record<string, unknown>?]>(),
  };
  const llmClient = new LLMClient({ adapter, providerName: 'test-llm', defaultTimeout: 1000 });
  const storyboardFramePlanner = new StoryboardFramePlanner({ llmClient });
  const planDeltas = vi.spyOn(storyboardFramePlanner, 'planDeltas');

  return { imageGenerationService, storyboardFramePlanner, generatePreview, planDeltas };
};

describe('StoryboardPreviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('throws when the prompt is empty', async () => {
      const { imageGenerationService, storyboardFramePlanner } = createServices();
      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      await expect(service.generateStoryboard({ prompt: '   ' })).rejects.toThrow(
        'Prompt is required and must be a non-empty string'
      );
    });

    it('throws when the planner returns the wrong number of deltas', async () => {
      const { imageGenerationService, storyboardFramePlanner, planDeltas } = createServices();
      planDeltas.mockResolvedValueOnce(['only one']);

      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      await expect(
        service.generateStoryboard({ prompt: 'valid prompt' })
      ).rejects.toThrow('Storyboard planner did not return the expected number of deltas');
    });

    it('propagates base image generation failures', async () => {
      const { imageGenerationService, storyboardFramePlanner, planDeltas, generatePreview } =
        createServices();
      planDeltas.mockResolvedValueOnce(['delta 1', 'delta 2', 'delta 3']);
      generatePreview.mockRejectedValueOnce(new Error('generation failed'));

      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      await expect(
        service.generateStoryboard({ prompt: 'valid prompt' })
      ).rejects.toThrow('generation failed');
    });
  });

  describe('edge cases', () => {
    it('uses the provided seed image URL and skips base generation', async () => {
      const { imageGenerationService, storyboardFramePlanner, planDeltas, generatePreview } =
        createServices();
      planDeltas.mockResolvedValueOnce(['delta 1', 'delta 2', 'delta 3']);
      generatePreview.mockResolvedValue({
        imageUrl: 'https://images.example.com/edit-1.webp',
        providerUrl: 'https://images.example.com/edit-1-provider.webp',
        metadata: {
          aspectRatio: '16:9',
          model: 'kontext-fast',
          duration: 1200,
          generatedAt: new Date().toISOString(),
        },
      });

      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      const result = await service.generateStoryboard({
        prompt: 'valid prompt',
        seedImageUrl: ' https://images.example.com/base.webp ',
      });

      expect(result.baseImageUrl).toBe('https://images.example.com/base.webp');
      expect(result.imageUrls).toHaveLength(STORYBOARD_FRAME_COUNT);
      const firstEditCall = generatePreview.mock.calls[0]?.[1];
      expect(firstEditCall?.inputImageUrl).toBe('https://images.example.com/base.webp');
    });

    it('uses a reference image to generate the base frame when provided', async () => {
      const { imageGenerationService, storyboardFramePlanner, planDeltas, generatePreview } =
        createServices();
      planDeltas.mockResolvedValueOnce(['delta 1', 'delta 2', 'delta 3']);
      generatePreview
        .mockResolvedValueOnce({
          imageUrl: 'https://images.example.com/base.webp',
          providerUrl: 'https://images.example.com/base-provider.webp',
          metadata: {
            aspectRatio: '16:9',
            model: 'kontext-fast',
            duration: 1200,
            generatedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValue({
          imageUrl: 'https://images.example.com/edit.webp',
          providerUrl: 'https://images.example.com/edit-provider.webp',
          metadata: {
            aspectRatio: '16:9',
            model: 'kontext-fast',
            duration: 1200,
            generatedAt: new Date().toISOString(),
          },
        });

      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      await service.generateStoryboard({
        prompt: 'valid prompt',
        referenceImageUrl: 'https://images.example.com/reference.webp',
      });

      const baseCall = generatePreview.mock.calls[0]?.[1];
      expect(baseCall?.provider).toBe(EDIT_PROVIDER);
      expect(baseCall?.inputImageUrl).toBe('https://images.example.com/reference.webp');
    });

    it('omits edit seeds when none are provided', async () => {
      const { imageGenerationService, storyboardFramePlanner, planDeltas, generatePreview } =
        createServices();
      planDeltas.mockResolvedValueOnce(['delta 1', 'delta 2', 'delta 3']);
      generatePreview
        .mockResolvedValueOnce({
          imageUrl: 'https://images.example.com/base.webp',
          providerUrl: 'https://images.example.com/base-provider.webp',
          metadata: {
            aspectRatio: '16:9',
            model: 'flux-schnell',
            duration: 1200,
            generatedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValue({
          imageUrl: 'https://images.example.com/edit.webp',
          providerUrl: 'https://images.example.com/edit-provider.webp',
          metadata: {
            aspectRatio: '16:9',
            model: 'kontext-fast',
            duration: 1200,
            generatedAt: new Date().toISOString(),
          },
        });

      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      await service.generateStoryboard({ prompt: 'valid prompt' });

      const editCall = generatePreview.mock.calls[1]?.[1];
      expect('seed' in (editCall ?? {})).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('generates a base image then chains edit frames with correct prompts', async () => {
      const { imageGenerationService, storyboardFramePlanner, planDeltas, generatePreview } =
        createServices();
      const deltas = ['delta 1', 'delta 2', 'delta 3'];
      planDeltas.mockResolvedValueOnce(deltas);
      generatePreview
        .mockResolvedValueOnce({
          imageUrl: 'https://images.example.com/base.webp',
          providerUrl: 'https://images.example.com/base-provider.webp',
          metadata: {
            aspectRatio: '16:9',
            model: 'flux-schnell',
            duration: 1200,
            generatedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValue({
          imageUrl: 'https://images.example.com/edit.webp',
          providerUrl: 'https://images.example.com/edit-provider.webp',
          metadata: {
            aspectRatio: '16:9',
            model: 'kontext-fast',
            duration: 1200,
            generatedAt: new Date().toISOString(),
          },
        });

      const service = new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });

      const result = await service.generateStoryboard({
        prompt: 'base prompt',
        aspectRatio: '16:9',
        seed: 12,
      });

      expect(result.imageUrls).toHaveLength(STORYBOARD_FRAME_COUNT);
      expect(result.imageUrls[0]).toBe('https://images.example.com/base.webp');

      const baseCall = generatePreview.mock.calls[0];
      const editCall = generatePreview.mock.calls[1];

      expect(baseCall?.[1]?.provider).toBe(BASE_PROVIDER);
      expect(baseCall?.[1]?.disablePromptTransformation).toBe(true);
      expect(editCall?.[0]).toBe(buildEditPrompt('base prompt', deltas[0]));
      expect(editCall?.[1]?.provider).toBe(EDIT_PROVIDER);
      expect(editCall?.[1]?.inputImageUrl).toBe('https://images.example.com/base-provider.webp');
      expect(editCall?.[1]?.seed).toBe(12);
    });
  });
});
