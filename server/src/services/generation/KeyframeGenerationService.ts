import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import FaceEmbeddingService from '@services/asset/FaceEmbeddingService';
import type { Asset } from '@shared/types/asset';

export interface KeyframeOptions {
  prompt: string;
  character: {
    primaryImageUrl: string | null;
    negativePrompt?: string;
    faceEmbedding?: string | null;
  };
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  faceStrength?: number;
}

export interface KeyframeResult {
  imageUrl: string;
  model: string;
  aspectRatio: string;
  faceStrength: number;
  prompt: string;
}

export class KeyframeGenerationService {
  private readonly replicate: Replicate | null;
  private readonly embeddingService: FaceEmbeddingService | null;
  private readonly log = logger.child({ service: 'KeyframeGenerationService' });

  constructor(options: { replicate?: Replicate; embeddingService?: FaceEmbeddingService; apiToken?: string } = {}) {
    if (options.replicate) {
      this.replicate = options.replicate;
    } else {
      const token = options.apiToken || process.env.REPLICATE_API_TOKEN;
      this.replicate = token ? new Replicate({ auth: token }) : null;
    }

    if (options.embeddingService) {
      this.embeddingService = options.embeddingService;
    } else if (this.replicate) {
      this.embeddingService = new FaceEmbeddingService(this.replicate);
    } else {
      this.embeddingService = null;
    }
  }

  async generateKeyframe({
    prompt,
    character,
    aspectRatio = '16:9',
    faceStrength = 0.7,
  }: KeyframeOptions): Promise<KeyframeResult> {
    if (!this.replicate) {
      throw new Error('Replicate provider is not configured. REPLICATE_API_TOKEN is required.');
    }

    if (!character?.primaryImageUrl) {
      throw new Error('Character must have a primary reference image');
    }

    const dimensions = this.getDimensions(aspectRatio);
    const modelId = 'lucataco/ip-adapter-faceid-plusv2';

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
        aspectRatio,
        faceStrength,
        prompt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Keyframe generation failed', error as Error);
      throw new Error(`Keyframe generation failed: ${errorMessage}`);
    }
  }

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
    const options = Array.from({ length: count }, (_, index) => {
      const faceStrength = 0.6 + index * 0.1;
      return this.generateKeyframe({
        prompt,
        character,
        aspectRatio,
        faceStrength,
      });
    });

    return await Promise.all(options);
  }

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

  getDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1024, height: 576 },
      '9:16': { width: 576, height: 1024 },
      '1:1': { width: 768, height: 768 },
      '4:3': { width: 896, height: 672 },
      '3:4': { width: 672, height: 896 },
    };

    return dimensions[aspectRatio] || dimensions['16:9'];
  }

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
