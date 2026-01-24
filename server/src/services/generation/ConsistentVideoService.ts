import type { VideoGenerationOptions, VideoGenerationResult } from '@services/video-generation/types';
import { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { ResolvedPrompt } from '@shared/types/asset';
import KeyframeGenerationService, { type KeyframeResult } from './KeyframeGenerationService';
import AssetService from '@services/asset/AssetService';
import { logger } from '@infrastructure/Logger';

export interface ConsistentVideoRequest {
  userId: string;
  prompt: string;
  videoModel?: string;
  aspectRatio?: VideoGenerationOptions['aspectRatio'];
  duration?: number;
  onProgress?: (update: { stage: string; message: string }) => void;
}

export class ConsistentVideoService {
  private readonly keyframeService: KeyframeGenerationService;
  private readonly assetService: AssetService;
  private readonly videoGenerationService: VideoGenerationService;
  private readonly log = logger.child({ service: 'ConsistentVideoService' });

  constructor(options: {
    keyframeService?: KeyframeGenerationService;
    assetService?: AssetService;
    videoGenerationService?: VideoGenerationService;
  } = {}) {
    this.keyframeService = options.keyframeService || new KeyframeGenerationService();
    this.assetService = options.assetService || new AssetService();
    if (!options.videoGenerationService) {
      throw new Error('VideoGenerationService is required');
    }
    this.videoGenerationService = options.videoGenerationService;
  }

  async generateConsistentVideo({
    userId,
    prompt,
    videoModel = 'luma',
    aspectRatio = '16:9',
    duration = 5,
    onProgress,
  }: ConsistentVideoRequest): Promise<{
    keyframe?: KeyframeResult;
    video: VideoGenerationResult;
    resolved: ResolvedPrompt;
    validation?: { isValid: boolean; confidence: number | null };
    character?: { id: string; name: string; trigger: string };
  }> {
    const operation = 'generateConsistentVideo';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      promptLength: prompt.length,
      videoModel,
      aspectRatio,
      duration,
    });

    try {
      onProgress?.({ stage: 'resolve', message: 'Resolving assets...' });
      const resolved = await this.assetService.resolvePrompt(userId, prompt);

      if (!resolved.requiresKeyframe || resolved.characters.length === 0) {
        onProgress?.({ stage: 'video', message: 'Generating video...' });
        const video = await this.generateVideoFromPrompt({
          prompt: resolved.expandedText,
          model: videoModel,
          aspectRatio,
          duration,
        });
        this.log.info('Operation completed.', {
          operation,
          userId,
          duration: Math.round(performance.now() - startTime),
          usedKeyframe: false,
          videoModel,
        });
        return { video, resolved };
      }

      const primaryCharacter = resolved.characters[0];
      const characterData = await this.assetService.getAssetForGeneration(
        userId,
        primaryCharacter.id
      );

      onProgress?.({
        stage: 'keyframe',
        message: `Generating keyframe with ${characterData.name}...`,
      });

      const keyframe = await this.keyframeService.generateKeyframe({
        prompt: resolved.expandedText,
        character: {
          primaryImageUrl: characterData.primaryImageUrl,
          negativePrompt: characterData.negativePrompt,
          faceEmbedding: characterData.faceEmbedding,
        },
        aspectRatio: this.resolveKeyframeAspectRatio(aspectRatio),
      });

      const validation = await this.keyframeService.validateKeyframeFace(
        keyframe.imageUrl,
        primaryCharacter
      );

      onProgress?.({ stage: 'video', message: 'Generating video...' });
      const video = await this.generateVideoFromKeyframe({
        keyframeUrl: keyframe.imageUrl,
        prompt: resolved.expandedText,
        model: videoModel,
        aspectRatio,
        duration,
      });

      this.log.info('Operation completed.', {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
        usedKeyframe: true,
        videoModel,
        validationConfidence: validation.confidence,
      });

      return {
        keyframe,
        video,
        resolved,
        validation,
        character: {
          id: characterData.id,
          name: characterData.name,
          trigger: characterData.trigger,
        },
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
        videoModel,
      });
      throw error;
    }
  }

  async generateVideoFromKeyframe({
    keyframeUrl,
    prompt,
    model,
    aspectRatio,
    duration,
  }: {
    keyframeUrl: string;
    prompt: string;
    model: string;
    aspectRatio?: VideoGenerationOptions['aspectRatio'];
    duration?: number;
  }): Promise<VideoGenerationResult> {
    const options: VideoGenerationOptions = {
      model,
      startImage: keyframeUrl,
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(this.resolveSeconds(duration) ? { seconds: this.resolveSeconds(duration) } : {}),
    };

    return await this.videoGenerationService.generateVideo(prompt, options);
  }

  async generateVideoFromPrompt({
    prompt,
    model,
    aspectRatio,
    duration,
  }: {
    prompt: string;
    model: string;
    aspectRatio?: VideoGenerationOptions['aspectRatio'];
    duration?: number;
  }): Promise<VideoGenerationResult> {
    const options: VideoGenerationOptions = {
      model,
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(this.resolveSeconds(duration) ? { seconds: this.resolveSeconds(duration) } : {}),
    };

    return await this.videoGenerationService.generateVideo(prompt, options);
  }

  async generateKeyframeOnly({
    userId,
    characterId,
    prompt,
    aspectRatio = '16:9',
    count = 1,
  }: {
    userId: string;
    characterId: string;
    prompt: string;
    aspectRatio?: VideoGenerationOptions['aspectRatio'];
    count?: number;
  }): Promise<KeyframeResult | KeyframeResult[]> {
    const resolved = await this.assetService.resolvePrompt(userId, prompt);
    const character = await this.assetService.getAssetForGeneration(userId, characterId);
    const keyframeAspectRatio = this.resolveKeyframeAspectRatio(aspectRatio);

    if (count === 1) {
      return await this.keyframeService.generateKeyframe({
        prompt: resolved.expandedText,
        character: {
          primaryImageUrl: character.primaryImageUrl,
          negativePrompt: character.negativePrompt,
          faceEmbedding: character.faceEmbedding,
        },
        aspectRatio: keyframeAspectRatio,
      });
    }

    return await this.keyframeService.generateKeyframeOptions({
      prompt: resolved.expandedText,
      character: {
        primaryImageUrl: character.primaryImageUrl,
        negativePrompt: character.negativePrompt,
        faceEmbedding: character.faceEmbedding,
      },
      aspectRatio: keyframeAspectRatio,
      count,
    });
  }

  async generateVideoFromApprovedKeyframe({
    keyframeUrl,
    prompt,
    model = 'luma',
    aspectRatio,
    duration = 5,
  }: {
    keyframeUrl: string;
    prompt: string;
    model?: string;
    aspectRatio?: VideoGenerationOptions['aspectRatio'];
    duration?: number;
  }): Promise<VideoGenerationResult> {
    return await this.generateVideoFromKeyframe({
      keyframeUrl,
      prompt,
      model,
      aspectRatio,
      duration,
    });
  }

  private resolveSeconds(duration?: number): VideoGenerationOptions['seconds'] | undefined {
    if (!duration) return undefined;
    const normalized = Math.round(duration);
    if (normalized === 4 || normalized === 8 || normalized === 12) {
      return String(normalized) as VideoGenerationOptions['seconds'];
    }
    return undefined;
  }

  private resolveKeyframeAspectRatio(
    aspectRatio?: VideoGenerationOptions['aspectRatio']
  ): '16:9' | '9:16' | '1:1' | '4:3' | '3:4' {
    if (!aspectRatio) return '16:9';
    const allowed = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);
    return allowed.has(aspectRatio) ? (aspectRatio as any) : '16:9';
  }
}

export default ConsistentVideoService;
