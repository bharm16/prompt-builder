/**
 * Image Generation Service
 *
 * Orchestrates preview image generation across providers.
 */

import { logger } from '@infrastructure/Logger';
import type { ImageGenerationOptions, ImageGenerationResult } from './types';
import type {
  ImagePreviewProvider,
  ImagePreviewProviderId,
  ImagePreviewProviderSelection,
} from './providers/types';
import { buildProviderPlan } from './providers/registry';

type ImageGenerationServiceConfig = {
  providers: ImagePreviewProvider[];
  defaultProvider?: ImagePreviewProviderSelection;
  fallbackOrder?: ImagePreviewProviderId[];
};

export class ImageGenerationService {
  private readonly providers: ImagePreviewProvider[];
  private readonly defaultProvider: ImagePreviewProviderSelection;
  private readonly fallbackOrder: ImagePreviewProviderId[];
  private readonly log = logger.child({ service: 'ImageGenerationService' });

  constructor(config: ImageGenerationServiceConfig) {
    this.providers = config.providers;
    this.defaultProvider = config.defaultProvider ?? 'auto';
    this.fallbackOrder = config.fallbackOrder ?? [];
  }

  /**
   * Generate a preview image from a prompt
   */
  public async generatePreview(
    prompt: string | null | undefined,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const userId = options.userId ?? 'anonymous';
    const trimmedPrompt = prompt.trim();
    const requestedProvider = options.provider ?? this.defaultProvider;

    const providerPlan = buildProviderPlan({
      providers: this.providers,
      requestedProvider,
      fallbackOrder: this.fallbackOrder,
    });

    if (providerPlan.length === 0) {
      const error = new Error(
        `No available image preview providers for selection: ${requestedProvider}`
      ) as Error & { statusCode?: number };
      error.statusCode = 503;
      throw error;
    }

    let lastError: unknown = null;

    for (const provider of providerPlan) {
      try {
        const result = await provider.generatePreview({
          prompt: trimmedPrompt,
          aspectRatio: options.aspectRatio,
          userId,
          inputImageUrl: options.inputImageUrl,
          seed: options.seed,
          speedMode: options.speedMode,
          outputQuality: options.outputQuality,
          disablePromptTransformation: options.disablePromptTransformation,
        });

        return {
          imageUrl: result.imageUrl,
          metadata: {
            aspectRatio: result.aspectRatio,
            model: result.model,
            duration: result.durationMs,
            generatedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        lastError = error;
        if (providerPlan.length > 1) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.log.warn('Image preview provider failed, trying next', {
            providerId: provider.id,
            error: errorMessage,
            userId,
          });
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Image generation failed');
  }
}
