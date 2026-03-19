import { describe, expect, it, vi } from 'vitest';
import ConsistentVideoService from '../ConsistentVideoService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type KeyframeGenerationService from '../KeyframeGenerationService';
import type AssetService from '@services/asset/AssetService';

const createVideoGenerationService = (): VideoGenerationService =>
  ({
    generateVideo: vi.fn(async () => ({
      assetId: 'asset-1',
      videoUrl: 'https://example.com/video.mp4',
      contentType: 'video/mp4',
    })),
  }) as unknown as VideoGenerationService;

const createKeyframeService = (): KeyframeGenerationService =>
  ({
    generateKeyframe: vi.fn(async () => ({
      imageUrl: 'https://images.example.com/keyframe.webp',
      model: 'fal-ai/flux-pulid',
      aspectRatio: '16:9',
      faceStrength: 0.8,
      prompt: 'expanded prompt',
      provider: 'pulid',
    })),
    generateKeyframeOptions: vi.fn(async () => [
      {
        imageUrl: 'https://images.example.com/keyframe-1.webp',
        model: 'fal-ai/flux-pulid',
        aspectRatio: '16:9',
        faceStrength: 0.8,
        prompt: 'expanded prompt',
        provider: 'pulid',
      },
      {
        imageUrl: 'https://images.example.com/keyframe-2.webp',
        model: 'fal-ai/flux-pulid',
        aspectRatio: '16:9',
        faceStrength: 0.6,
        prompt: 'expanded prompt',
        provider: 'pulid',
      },
    ]),
    validateKeyframeFace: vi.fn(async () => ({ isValid: true, confidence: 0.92 })),
  }) as unknown as KeyframeGenerationService;

const createAssetService = (): AssetService =>
  ({
    resolvePrompt: vi.fn(async () => ({
      originalText: 'raw prompt',
      expandedText: 'expanded prompt',
      assets: [],
      characters: [],
      styles: [],
      locations: [],
      objects: [],
      requiresKeyframe: false,
      negativePrompts: [],
      referenceImages: [],
    })),
    getAssetForGeneration: vi.fn(async () => ({
      id: 'char-1',
      type: 'character',
      trigger: '@hero',
      name: 'Hero Character',
      textDefinition: 'A hero',
      negativePrompt: 'bad anatomy',
      primaryImageUrl: 'https://images.example.com/hero.webp',
      referenceImages: [],
      faceEmbedding: null,
    })),
  }) as unknown as AssetService;

describe('ConsistentVideoService', () => {
  it('throws when VideoGenerationService is not provided', () => {
    expect(() => new ConsistentVideoService()).toThrow('VideoGenerationService is required');
  });

  it('generates video directly when prompt does not require keyframe', async () => {
    const videoGenerationService = createVideoGenerationService();
    const keyframeService = createKeyframeService();
    const assetService = createAssetService();
    const service = new ConsistentVideoService({
      videoGenerationService,
      keyframeService,
      assetService,
    });

    const result = await service.generateConsistentVideo({
      userId: 'user-1',
      prompt: 'raw prompt',
      videoModel: 'sora-2',
      aspectRatio: '16:9',
      duration: 8,
    });

    expect(assetService.resolvePrompt).toHaveBeenCalledWith('user-1', 'raw prompt');
    expect(videoGenerationService.generateVideo).toHaveBeenCalledWith(
      'expanded prompt',
      expect.objectContaining({
        model: 'sora-2',
        aspectRatio: '16:9',
        seconds: '8',
      })
    );
    expect(result.keyframe).toBeUndefined();
    expect(result.video.videoUrl).toBe('https://example.com/video.mp4');
  });

  it('orchestrates keyframe -> validation -> i2v generation when required', async () => {
    const videoGenerationService = createVideoGenerationService();
    const keyframeService = createKeyframeService();
    const assetService = createAssetService();
    (assetService.resolvePrompt as ReturnType<typeof vi.fn>).mockResolvedValue({
      originalText: 'raw prompt',
      expandedText: 'expanded prompt',
      assets: [{ id: 'char-1' }],
      characters: [{ id: 'char-1' }],
      styles: [],
      locations: [],
      objects: [],
      requiresKeyframe: true,
      negativePrompts: [],
      referenceImages: [],
    });

    const service = new ConsistentVideoService({
      videoGenerationService,
      keyframeService,
      assetService,
    });

    const result = await service.generateConsistentVideo({
      userId: 'user-1',
      prompt: 'raw prompt',
      videoModel: 'luma',
      aspectRatio: '9:16',
      duration: 4,
    });

    expect(assetService.getAssetForGeneration).toHaveBeenCalledWith('user-1', 'char-1');
    expect(keyframeService.generateKeyframe).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'expanded prompt',
        aspectRatio: '9:16',
      })
    );
    expect(keyframeService.validateKeyframeFace).toHaveBeenCalledWith(
      'https://images.example.com/keyframe.webp',
      expect.objectContaining({ id: 'char-1' })
    );
    expect(videoGenerationService.generateVideo).toHaveBeenCalledWith(
      'expanded prompt',
      expect.objectContaining({
        model: 'luma',
        startImage: 'https://images.example.com/keyframe.webp',
        aspectRatio: '9:16',
        seconds: '4',
      })
    );
    expect(result.character).toEqual({
      id: 'char-1',
      name: 'Hero Character',
      trigger: '@hero',
    });
    expect(result.validation).toEqual({ isValid: true, confidence: 0.92 });
  });

  it('supports single and multi keyframe generation paths', async () => {
    const videoGenerationService = createVideoGenerationService();
    const keyframeService = createKeyframeService();
    const assetService = createAssetService();
    const service = new ConsistentVideoService({
      videoGenerationService,
      keyframeService,
      assetService,
    });

    const single = await service.generateKeyframeOnly({
      userId: 'user-1',
      characterId: 'char-1',
      prompt: 'raw prompt',
      count: 1,
    });
    expect(keyframeService.generateKeyframe).toHaveBeenCalledTimes(1);
    expect(Array.isArray(single)).toBe(false);

    const multiple = await service.generateKeyframeOnly({
      userId: 'user-1',
      characterId: 'char-1',
      prompt: 'raw prompt',
      count: 2,
    });
    expect(keyframeService.generateKeyframeOptions).toHaveBeenCalledTimes(1);
    expect(Array.isArray(multiple)).toBe(true);
    expect(multiple).toHaveLength(2);
  });

  it('delegates generateVideoFromApprovedKeyframe to i2v generation helper', async () => {
    const videoGenerationService = createVideoGenerationService();
    const keyframeService = createKeyframeService();
    const assetService = createAssetService();
    const service = new ConsistentVideoService({
      videoGenerationService,
      keyframeService,
      assetService,
    });

    await service.generateVideoFromApprovedKeyframe({
      keyframeUrl: 'https://images.example.com/keyframe.webp',
      prompt: 'expanded prompt',
      model: 'sora-2',
      aspectRatio: '16:9',
      duration: 12,
    });

    expect(videoGenerationService.generateVideo).toHaveBeenCalledWith(
      'expanded prompt',
      expect.objectContaining({
        model: 'sora-2',
        startImage: 'https://images.example.com/keyframe.webp',
        seconds: '12',
      })
    );
  });

  it('propagates dependency failures', async () => {
    const videoGenerationService = createVideoGenerationService();
    const keyframeService = createKeyframeService();
    const assetService = createAssetService();
    (assetService.resolvePrompt as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('resolve failed')
    );
    const service = new ConsistentVideoService({
      videoGenerationService,
      keyframeService,
      assetService,
    });

    await expect(
      service.generateConsistentVideo({
        userId: 'user-1',
        prompt: 'raw prompt',
      })
    ).rejects.toThrow('resolve failed');
  });
});
