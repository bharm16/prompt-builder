/**
 * KeyframeGenerationService
 *
 * Orchestrates keyframe generation with face consistency.
 *
 * Provider Priority (Jan 2026):
 * 1. PuLID via fal.ai (Flux + PuLID) - Current standard for face identity
 *
 * Legacy IP-Adapter paths have been removed from default execution.
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
  faceStrength?: number | undefined; // Maps to idWeight for PuLID
}

export interface KeyframeResult {
  imageUrl: string;
  model: string;
  aspectRatio: string;
  faceStrength: number;
  prompt: string;
  seed?: number | undefined;
  provider: 'pulid';
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

    // Optional Replicate client (used only for face embedding validation)
    if (options.replicate) {
      this.replicate = options.replicate;
    } else {
      const token = options.apiToken || process.env.REPLICATE_API_TOKEN;
      this.replicate = token ? new Replicate({ auth: token }) : null;
    }

    // Embedding service for face validation (requires explicit opt-in)
    const enableFaceEmbedding = process.env.ENABLE_FACE_EMBEDDING === 'true';
    if (options.embeddingService) {
      this.embeddingService = options.embeddingService;
    } else if (enableFaceEmbedding && this.replicate) {
      this.embeddingService = new FaceEmbeddingService(this.replicate);
    } else {
      this.embeddingService = null;
    }
  }

  /**
   * Check which provider is available
   */
  public getAvailableProvider(): 'pulid' | null {
    if (this.pulidProvider.isAvailable()) {
      return 'pulid';
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

    if (!this.pulidProvider.isAvailable()) {
      throw new Error('PuLID keyframe generation is not configured. Set FAL_KEY or FAL_API_KEY to enable face-consistent keyframes.');
    }

    return this.generateWithPulid({
      prompt,
      character,
      aspectRatio,
      faceStrength,
    });
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

    const normalizedAspectRatio = this.normalizeAspectRatio(aspectRatio);
    const operation = 'generateWithPulid';
    const startTime = performance.now();
    this.log.info('Generating keyframe with PuLID', {
      operation,
      aspectRatio: normalizedAspectRatio,
      idWeight: faceStrength,
      promptLength: prompt.length,
    });

    const result: FalPulidKeyframeResult = await this.pulidProvider.generateKeyframe({
      prompt,
      faceImageUrl: character.primaryImageUrl,
      aspectRatio: normalizedAspectRatio,
      idWeight: faceStrength ?? undefined,
      negativePrompt: character.negativePrompt ?? undefined,
    });

    this.log.info('Keyframe generated', {
      operation,
      duration: Math.round(performance.now() - startTime),
      model: result.model,
      aspectRatio: result.aspectRatio,
      idWeight: result.idWeight,
      provider: 'pulid',
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
    if (!this.pulidProvider.isAvailable()) {
      throw new Error('PuLID keyframe generation is not configured. Set FAL_KEY or FAL_API_KEY to enable face-consistent keyframes.');
    }
    if (!character?.primaryImageUrl) {
      throw new Error('Character must have a primary reference image');
    }

    const normalizedAspectRatio = this.normalizeAspectRatio(aspectRatio);
    const results = await this.pulidProvider.generateKeyframeOptions({
      prompt,
      faceImageUrl: character.primaryImageUrl,
      aspectRatio: normalizedAspectRatio,
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

    const operation = 'validateKeyframeFace';
    const startTime = performance.now();

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
      let keyframeHost: string | undefined;
      try {
        keyframeHost = new URL(keyframeUrl).host;
      } catch {
        keyframeHost = undefined;
      }
      this.log.warn('Face validation failed', {
        operation,
        duration: Math.round(performance.now() - startTime),
        error: errorMessage,
        ...(keyframeHost ? { keyframeHost } : {}),
      });
      return { isValid: true, confidence: null };
    }
  }

  private normalizeAspectRatio(
    aspectRatio?: KeyframeOptions['aspectRatio']
  ): '16:9' | '9:16' | '1:1' | '4:3' | '3:4' {
    const allowed = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
    return allowed.includes(aspectRatio as (typeof allowed)[number])
      ? (aspectRatio as (typeof allowed)[number])
      : '16:9';
  }
}

export default KeyframeGenerationService;
