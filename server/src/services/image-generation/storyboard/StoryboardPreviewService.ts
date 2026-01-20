import { logger } from '@infrastructure/Logger';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type { ImagePreviewSpeedMode } from '@services/image-generation/providers/types';
import { StoryboardFramePlanner } from './StoryboardFramePlanner';

export const STORYBOARD_FRAME_COUNT = 4;
const CONTINUITY_HEADER =
  'Continuity: preserve the same character identity, wardrobe, scene, lighting, and style. Apply only the change described.';

const buildEditPrompt = (basePrompt: string, delta: string): string =>
  `${CONTINUITY_HEADER}\nBase prompt: ${basePrompt}\nEdit instruction: ${delta}`;

export interface StoryboardPreviewRequest {
  prompt: string;
  aspectRatio?: string;
  seedImageUrl?: string;
  speedMode?: ImagePreviewSpeedMode;
  seed?: number;
  userId?: string;
}

export interface StoryboardPreviewResult {
  imageUrls: string[];
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
    const deltas = await this.storyboardFramePlanner.planDeltas(
      trimmedPrompt,
      STORYBOARD_FRAME_COUNT
    );

    if (deltas.length !== STORYBOARD_FRAME_COUNT - 1) {
      throw new Error('Storyboard planner did not return the expected number of deltas');
    }

    this.log.info('Storyboard deltas planned', {
      userId,
      deltas: deltas.map((delta) => delta.substring(0, 140)),
    });

    const seedImageUrl =
      typeof request.seedImageUrl === 'string' && request.seedImageUrl.trim().length > 0
        ? request.seedImageUrl.trim()
        : undefined;

    let baseImageUrl: string;
    if (seedImageUrl) {
      baseImageUrl = seedImageUrl;
    } else {
      const baseResult = await this.imageGenerationService.generatePreview(trimmedPrompt, {
        ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
        provider: 'replicate-flux-schnell',
        userId,
        disablePromptTransformation: true,
      });
      baseImageUrl = baseResult.imageUrl;
    }

    const imageUrls: string[] = [baseImageUrl];
    let previousUrl = baseImageUrl;
    const seedBase =
      typeof request.seed === 'number' && Number.isFinite(request.seed)
        ? Math.round(request.seed)
        : undefined;

    for (let index = 0; index < deltas.length; index += 1) {
      const delta = deltas[index];
      const editPrompt = buildEditPrompt(trimmedPrompt, delta);
      const editSeed = seedBase !== undefined ? seedBase + index : undefined;

      const result = await this.imageGenerationService.generatePreview(editPrompt, {
        ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
        provider: 'replicate-flux-kontext-fast',
        inputImageUrl: previousUrl,
        ...(request.speedMode ? { speedMode: request.speedMode } : {}),
        userId,
        ...(editSeed !== undefined ? { seed: editSeed } : {}),
        disablePromptTransformation: true,
      });

      previousUrl = result.imageUrl;
      imageUrls.push(result.imageUrl);
    }

    this.log.info('Storyboard frames generated', {
      userId,
      imageUrls: imageUrls.map((url) => url.substring(0, 120)),
    });

    return {
      imageUrls,
      deltas,
      baseImageUrl,
    };
  }
}
