/**
 * KeyframeGenerationService
 *
 * Orchestrates keyframe generation with face consistency.
 *
 * Provider Priority (Jan 2026):
 * 1. PuLID via fal.ai (Flux + PuLID) - Current standard for face identity
 * 2. Legacy IP-Adapter via Replicate - Fallback for users without FAL_KEY
 *
 * The IP-Adapter FaceID Plus v2 approach is considered legacy as of 2025/2026.
 * PuLID on Flux provides superior face identity preservation and is the
 * recommended approach for new implementations.
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import FaceEmbeddingService from '@services/asset/FaceEmbeddingService';
import type { Asset } from '@shared/types/asset';
import {
  FalPulidKeyframeProvider,
  type FalPulidKeyframeResult,
} from './providers/FalPulidKeyframeProvider';

export interface KeyframeOptions {
  prompt: string;
  character: {
    primaryImageUrl: string | null;
    negativePrompt?: string | undefined;
    faceEmbedding?: string | null | undefined;
  };
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | undefined;
  faceStrength?: number | undefined; // Maps to idWeight for PuLID, ip_adapter_scale for legacy
}

export interface KeyframeResult {
  imageUrl: string;
  model: string;
  aspectRatio: string;
  faceStrength: number;
  prompt: string;
  seed?: number | undefined;
  provider: 'pulid' | 'ip-adapter-legacy';
}

export class KeyframeGenerationService {
  private readonly pulidProvider: FalPulidKeyframeProvider;
  private readonly replicate: Replicate | null;
  private readonly embeddingService: FaceEmbeddingService | null;
  private readonly log = logger.child({ service: 'KeyframeGenerationService' });

  constructor(options: {
    replicate?: Replicate;
    embeddingService?: FaceEmbeddingService;
    pulidProvider?: FalPulidKeyframeProvider;
    apiToken?: string;
    falApiKey?: string;
  } = {}) {
    // PuLID provider (preferred)
    this.pulidProvider = options.pulidProvider ?? new FalPulidKeyframeProvider(
      options.falApiKey ? { apiKey: options.falApiKey } : {}
    );

    // Legacy Replicate provider (fallback)
    if (options.replicate) {
      this.replicate = options.replicate;
    } else {
      const token = options.apiToken || process.env.REPLICATE_API_TOKEN;
      this.replicate = token ? new Replicate({ auth: token }) : null;
    }

    // Embedding service for face validation
    if (options.embeddingService) {
      this.embeddingService = options.embeddingService;
    } else if (this.replicate) {
      this.embeddingService = new FaceEmbeddingService(this.replicate);
    } else {
      this.embeddingService = null;
    }
  }

  /**
   * Check which provider is available
   */
  public getAvailableProvider(): 'pulid' | 'ip-adapter-legacy' | null {
    if (this.pulidProvider.isAvailable()) {
      return 'pulid';
    }
    if (this.replicate) {
      return 'ip-adapter-legacy';
    }
    return null;
  }

  /**
   * Generate a keyframe using the best available provider
   */
  async generateKeyframe({
    prompt,
    character,
    aspectRatio = '16:9',
    faceStrength = 0.8,
  }: KeyframeOptions): Promise<KeyframeResult> {
    if (!character?.primaryImageUrl) {
      throw new Error('Character must have a primary reference image');
    }

    // Try PuLID first (preferred for quality)
    if (this.pulidProvider.isAvailable()) {
      return this.generateWithPulid({
        prompt,
        character,
        aspectRatio,
        faceStrength,
      });
    }

    // Fall back to legacy IP-Adapter
    if (this.replicate) {
      this.log.warn('Using legacy IP-Adapter. Consider configuring FAL_KEY for better results with PuLID.');
      return this.generateWithLegacyIpAdapter({
        prompt,
        character,
        aspectRatio,
        faceStrength,
      });
    }

    throw new Error(
      'No keyframe provider is configured. Set FAL_KEY for PuLID or REPLICATE_API_TOKEN for legacy IP-Adapter.'
    );
  }

  /**
   * Generate using PuLID via fal.ai
   */
  private async generateWithPulid({
    prompt,
    character,
    aspectRatio,
    faceStrength,
  }: KeyframeOptions): Promise<KeyframeResult> {
    if (!character?.primaryImageUrl) {
      throw new Error('Character must have a primary reference image');
    }

    this.log.info('Generating keyframe with PuLID', {
      aspectRatio,
      idWeight: faceStrength,
    });

    const result: FalPulidKeyframeResult = await this.pulidProvider.generateKeyframe({
      prompt,
      faceImageUrl: character.primaryImageUrl,
      aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4',
      idWeight: faceStrength ?? undefined,
      negativePrompt: character.negativePrompt ?? undefined,
    });

    return {
      imageUrl: result.imageUrl,
      model: result.model,
      aspectRatio: result.aspectRatio,
      faceStrength: result.idWeight,
      prompt: result.prompt,
      ...(result.seed !== undefined ? { seed: result.seed } : {}),
      provider: 'pulid',
    } as KeyframeResult;
  }

  /**
   * Generate using legacy IP-Adapter via Replicate
   * @deprecated Use PuLID instead for better results
   */
  private async generateWithLegacyIpAdapter({
    prompt,
    character,
    aspectRatio = '16:9',
    faceStrength = 0.7,
  }: KeyframeOptions): Promise<KeyframeResult> {
    if (!this.replicate) {
      throw new Error('Replicate provider is not configured.');
    }

    if (!character?.primaryImageUrl) {
      throw new Error('Character must have a primary reference image');
    }

    const dimensions = this.getDimensions(aspectRatio);
    const modelId = 'lucataco/ip-adapter-faceid-plusv2';

    this.log.info('Generating keyframe with legacy IP-Adapter', {
      modelId,
      aspectRatio,
      faceStrength,
    });

    try {
      const output = (await this.replicate.run(modelId as any, {
        input: {
          prompt: this.enhancePromptForKeyframe(prompt),
          face_image: character.primaryImageUrl,
          negative_prompt: this.buildNegativePrompt(character.negativePrompt),
          num_outputs: 1,
          guidance_scale: 7.5,
          ip_adapter_scale: faceStrength,
          num_inference_steps: 30,
          width: dimensions.width,
          height: dimensions.height,
        },
      })) as unknown;

      const imageUrl = this.extractOutputUrl(output);
      if (!imageUrl) {
        throw new Error('Keyframe generation returned no output');
      }

      return {
        imageUrl,
        model: modelId,
        aspectRatio: aspectRatio ?? '16:9',
        faceStrength,
        prompt,
        provider: 'ip-adapter-legacy',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Legacy IP-Adapter keyframe generation failed', error as Error);
      throw new Error(`Keyframe generation failed: ${errorMessage}`);
    }
  }

  /**
   * Generate multiple keyframe options with varying face strengths
   */
  async generateKeyframeOptions({
    prompt,
    character,
    aspectRatio = '16:9',
    count = 3,
  }: {
    prompt: string;
    character: KeyframeOptions['character'];
    aspectRatio?: KeyframeOptions['aspectRatio'];
    count?: number;
  }): Promise<KeyframeResult[]> {
    // Use PuLID if available
    if (this.pulidProvider.isAvailable() && character?.primaryImageUrl) {
      const results = await this.pulidProvider.generateKeyframeOptions({
        prompt,
        faceImageUrl: character.primaryImageUrl,
        aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4',
        negativePrompt: character.negativePrompt ?? undefined,
        count,
      });

      return results.map(result => ({
        imageUrl: result.imageUrl,
        model: result.model,
        aspectRatio: result.aspectRatio,
        faceStrength: result.idWeight,
        prompt: result.prompt,
        ...(result.seed !== undefined ? { seed: result.seed } : {}),
        provider: 'pulid' as const,
      } as KeyframeResult));
    }

    // Fall back to legacy provider
    const options = Array.from({ length: count }, (_, index) => {
      const faceStrength = 0.6 + index * 0.1;
      return this.generateKeyframe({
        prompt,
        character,
        aspectRatio,
        faceStrength,
      });
    });

    return Promise.all(options);
  }

  /**
   * Validate that a generated keyframe contains the expected face
   */
  async validateKeyframeFace(
    keyframeUrl: string,
    character: Asset
  ): Promise<{ isValid: boolean; confidence: number | null }> {
    if (!character.faceEmbedding || !this.embeddingService) {
      return { isValid: true, confidence: null };
    }

    try {
      const keyframeResult = await this.embeddingService.extractEmbedding(keyframeUrl);
      const referenceEmbedding = this.embeddingService.deserializeEmbedding(character.faceEmbedding);

      const similarity = this.embeddingService.computeSimilarity(
        keyframeResult.embedding,
        referenceEmbedding
      );

      return {
        isValid: similarity > 0.5,
        confidence: similarity,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Face validation failed', { error: errorMessage });
      return { isValid: true, confidence: null };
    }
  }

  // Helper methods

  enhancePromptForKeyframe(prompt: string): string {
    const qualityTerms = ['high quality', '4k', 'detailed', 'sharp focus'];
    const hasQuality = qualityTerms.some((term) => prompt.toLowerCase().includes(term));
    return hasQuality ? prompt : `${prompt}, high quality, detailed, sharp focus`;
  }

  buildNegativePrompt(customNegative?: string): string {
    const baseNegative = 'blurry, low quality, distorted face, deformed, ugly, bad anatomy';
    if (customNegative) {
      return `${baseNegative}, ${customNegative}`;
    }
    return baseNegative;
  }

  getDimensions(aspectRatio?: string): { width: number; height: number } {
    const DEFAULT_DIMENSIONS = { width: 1024, height: 576 };
    const dimensions: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1024, height: 576 },
      '9:16': { width: 576, height: 1024 },
      '1:1': { width: 768, height: 768 },
      '4:3': { width: 896, height: 672 },
      '3:4': { width: 672, height: 896 },
    };

    const key = aspectRatio ?? '16:9';
    const result = dimensions[key];
    return result ?? DEFAULT_DIMENSIONS;
  }

  private extractOutputUrl(output: unknown): string | null {
    if (typeof output === 'string') {
      return output;
    }

    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
      return output[0];
    }

    if (output && typeof output === 'object' && 'url' in output) {
      const urlFn = (output as { url?: () => string }).url;
      if (typeof urlFn === 'function') {
        return urlFn().toString();
      }
    }

    return null;
  }
}

export default KeyframeGenerationService;
