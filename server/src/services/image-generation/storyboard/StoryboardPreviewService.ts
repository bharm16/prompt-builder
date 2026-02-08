import { logger } from '@infrastructure/Logger';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type { ImagePreviewSpeedMode } from '@services/image-generation/providers/types';
import { StoryboardFramePlanner } from './StoryboardFramePlanner';
import { BASE_PROVIDER, EDIT_PROVIDER, STORYBOARD_FRAME_COUNT } from './constants';
import { buildEditPrompt } from './prompts';
import {
  computeEditSeed,
  computeSeedBase,
  normalizeSeedImageUrl,
  resolveChainingUrl,
} from './storyboardUtils';

export { STORYBOARD_FRAME_COUNT } from './constants';

export interface StoryboardPreviewRequest {
  prompt: string;
  aspectRatio?: string;
  seedImageUrl?: string;
  referenceImageUrl?: string;
  speedMode?: ImagePreviewSpeedMode;
  seed?: number;
  userId?: string;
}

export interface StoryboardPreviewResult {
  imageUrls: string[];
  storagePaths: string[];
  deltas: string[];
  baseImageUrl: string;
}

export interface StoryboardPreviewServiceOptions {
  imageGenerationService: ImageGenerationService;
  storyboardFramePlanner: StoryboardFramePlanner;
}

export class StoryboardPreviewService {
  private readonly imageGenerationService: ImageGenerationService;
  private readonly storyboardFramePlanner: StoryboardFramePlanner;
  private readonly log = logger.child({ service: 'StoryboardPreviewService' });

  constructor(options: StoryboardPreviewServiceOptions) {
    this.imageGenerationService = options.imageGenerationService;
    this.storyboardFramePlanner = options.storyboardFramePlanner;
  }

  async generateStoryboard(request: StoryboardPreviewRequest): Promise<StoryboardPreviewResult> {
    const trimmedPrompt = request.prompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const userId = request.userId ?? 'anonymous';
    const seedImageUrl = normalizeSeedImageUrl(request.seedImageUrl);
    const referenceImageUrl = normalizeSeedImageUrl(request.referenceImageUrl);
    const effectiveReferenceImageUrl = seedImageUrl ? undefined : referenceImageUrl;
    this.log.info('Storyboard preview generation started', {
      userId,
      promptLength: trimmedPrompt.length,
      aspectRatio: request.aspectRatio,
      speedMode: request.speedMode,
      seedProvided: request.seed !== undefined,
      hasSeedImage: Boolean(seedImageUrl),
      hasReferenceImage: Boolean(referenceImageUrl),
    });
    const deltas = await this.storyboardFramePlanner.planDeltas(
      trimmedPrompt,
      STORYBOARD_FRAME_COUNT
    );

    if (deltas.length !== STORYBOARD_FRAME_COUNT - 1) {
      throw new Error('Storyboard planner did not return the expected number of deltas');
    }

    this.log.info('Storyboard deltas planned', {
      userId,
      deltaCount: deltas.length,
    });

    const { baseImageUrl, baseProviderUrl, baseStoragePath } = await this.resolveBaseImage({
      prompt: trimmedPrompt,
      ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
      ...(seedImageUrl ? { seedImageUrl } : {}),
      ...(effectiveReferenceImageUrl ? { referenceImageUrl: effectiveReferenceImageUrl } : {}),
      ...(request.speedMode ? { speedMode: request.speedMode } : {}),
      userId,
    });
    const baseProvider = seedImageUrl
      ? 'seed-image'
      : effectiveReferenceImageUrl
        ? EDIT_PROVIDER
        : BASE_PROVIDER;
    this.log.info('Storyboard base image resolved', {
      userId,
      baseProvider,
      usedSeedImage: Boolean(seedImageUrl),
      usedReferenceImage: Boolean(effectiveReferenceImageUrl),
    });

    const { imageUrls, storagePaths } = await this.generateEditFrames({
      baseImageUrl,
      baseProviderUrl,
      ...(baseStoragePath ? { baseStoragePath } : {}),
      deltas,
      prompt: trimmedPrompt,
      ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
      ...(request.speedMode ? { speedMode: request.speedMode } : {}),
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      userId,
    });

    this.log.info('Storyboard frames generated', {
      userId,
      imageCount: imageUrls.length,
      baseProvider,
      editProvider: EDIT_PROVIDER,
    });

    return {
      imageUrls,
      storagePaths,
      deltas,
      baseImageUrl,
    };
  }

  private async resolveBaseImage(options: {
    prompt: string;
    aspectRatio?: string;
    seedImageUrl?: string;
    referenceImageUrl?: string;
    speedMode?: ImagePreviewSpeedMode;
    userId: string;
  }): Promise<{ baseImageUrl: string; baseProviderUrl: string; baseStoragePath?: string }> {
    const normalizedSeedImageUrl = normalizeSeedImageUrl(options.seedImageUrl);
    if (normalizedSeedImageUrl) {
      return {
        baseImageUrl: normalizedSeedImageUrl,
        baseProviderUrl: normalizedSeedImageUrl,
      };
    }

    const referenceImageUrl = normalizeSeedImageUrl(options.referenceImageUrl);
    const provider = referenceImageUrl ? EDIT_PROVIDER : BASE_PROVIDER;

    let baseResult;
    try {
      baseResult = await this.imageGenerationService.generatePreview(options.prompt, {
        ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
        provider,
        ...(referenceImageUrl ? { inputImageUrl: referenceImageUrl } : {}),
        ...(options.speedMode ? { speedMode: options.speedMode } : {}),
        userId: options.userId,
        disablePromptTransformation: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error(
        'Storyboard base image generation failed',
        error instanceof Error ? error : new Error(errorMessage),
        {
          userId: options.userId,
          provider,
          aspectRatio: options.aspectRatio,
          usedReferenceImage: Boolean(referenceImageUrl),
        }
      );
      throw error;
    }

    return {
      baseImageUrl: baseResult.imageUrl,
      baseProviderUrl: resolveChainingUrl(baseResult),
      ...(baseResult.storagePath ? { baseStoragePath: baseResult.storagePath } : {}),
    };
  }

  private async generateEditFrames(options: {
    baseImageUrl: string;
    baseProviderUrl: string;
    baseStoragePath?: string;
    deltas: string[];
    prompt: string;
    aspectRatio?: string;
    speedMode?: ImagePreviewSpeedMode;
    seed?: number;
    userId: string;
  }): Promise<{ imageUrls: string[]; storagePaths: string[] }> {
    const imageUrls: string[] = [options.baseImageUrl];
    const storagePaths: string[] = [options.baseStoragePath ?? ''];
    let previousUrl = options.baseProviderUrl;
    const seedBase = computeSeedBase(options.seed);

    for (let index = 0; index < options.deltas.length; index += 1) {
      const delta = options.deltas[index]!;
      const editPrompt = buildEditPrompt(options.prompt, delta);
      const editSeed = computeEditSeed(seedBase, index);

      try {
        this.log.debug('Storyboard edit frame generation started', {
          userId: options.userId,
          frameIndex: index + 1,
        });

        const result = await this.imageGenerationService.generatePreview(editPrompt, {
          ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
          provider: EDIT_PROVIDER,
          inputImageUrl: previousUrl,
          ...(options.speedMode ? { speedMode: options.speedMode } : {}),
          userId: options.userId,
          ...(editSeed !== undefined ? { seed: editSeed } : {}),
          disablePromptTransformation: true,
        });

        previousUrl = resolveChainingUrl(result);
        imageUrls.push(result.imageUrl);
        storagePaths.push(result.storagePath ?? '');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log.error(
          'Storyboard edit frame generation failed',
          error instanceof Error ? error : new Error(errorMessage),
          {
            userId: options.userId,
            frameIndex: index + 1,
            deltaPreview: delta.slice(0, 160),
            provider: EDIT_PROVIDER,
          }
        );
        throw error;
      }
    }

    return { imageUrls, storagePaths };
  }
}
