/**
 * FaceSwapService
 *
 * Orchestrates face-swap preprocessing for character-consistent i2v.
 * Used when both startImage and characterAssetId are provided.
 */

import { logger } from '@infrastructure/Logger';
import { FalFaceSwapProvider, type FaceSwapOptions } from './providers/FalFaceSwapProvider';

export interface FaceSwapRequest {
  characterPrimaryImageUrl: string;
  targetCompositionUrl: string;
  aspectRatio?: string;
}

export interface FaceSwapResponse {
  swappedImageUrl: string;
  provider: 'easel';
  durationMs: number;
}

export class FaceSwapService {
  private readonly faceSwapProvider: FalFaceSwapProvider;
  private readonly log = logger.child({ service: 'FaceSwapService' });

  constructor(options: { faceSwapProvider?: FalFaceSwapProvider } = {}) {
    this.faceSwapProvider = options.faceSwapProvider ?? new FalFaceSwapProvider();
  }

  public isAvailable(): boolean {
    return this.faceSwapProvider.isAvailable();
  }

  public async swap(request: FaceSwapRequest): Promise<FaceSwapResponse> {
    if (!this.faceSwapProvider.isAvailable()) {
      throw new Error('Face-swap provider is not configured. Set FAL_KEY or FAL_API_KEY.');
    }

    if (!request.characterPrimaryImageUrl) {
      throw new Error('Character reference image is required for face swap');
    }

    if (!request.targetCompositionUrl) {
      throw new Error('Target composition image is required for face swap');
    }

    const operation = 'swap';
    const startTime = performance.now();

    this.log.info('Starting face swap preprocessing', {
      operation,
      aspectRatio: request.aspectRatio ?? null,
    });

    try {
      const options: FaceSwapOptions = {
        faceImageUrl: request.characterPrimaryImageUrl,
        targetImageUrl: request.targetCompositionUrl,
        preserveHair: 'user',
        upscale: true,
      };

      const result = await this.faceSwapProvider.swapFace(options);
      const durationMs = Math.round(performance.now() - startTime);

      this.log.info('Face swap preprocessing completed', {
        operation,
        durationMs,
      });

      return {
        swappedImageUrl: result.imageUrl,
        provider: 'easel',
        durationMs,
      };
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      const errorMessage = errorInstance.message;
      this.log.error('Face swap preprocessing failed', errorInstance, {
        operation,
        durationMs: Math.round(performance.now() - startTime),
      });
      throw new Error(`Face swap preprocessing failed: ${errorMessage}`);
    }
  }
}

export default FaceSwapService;
