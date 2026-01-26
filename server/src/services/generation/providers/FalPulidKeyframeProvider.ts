/**
 * FalPulidKeyframeProvider
 *
 * Uses Flux + PuLID (Pure Lightning ID) via fal.ai for face-consistent keyframe generation.
 * PuLID is the 2025/2026 standard for face identity in Flux, replacing the legacy
 * IP-Adapter FaceID Plus v2 approach.
 *
 * Key improvements over IP-Adapter:
 * - Native Flux support (not SDXL)
 * - Superior face identity preservation
 * - Better lighting and composition handling
 * - Faster inference on fal.ai infrastructure
 */

import { logger } from '@infrastructure/Logger';
import { resolveFalApiKey } from '@utils/falApiKey';

export interface FalPulidKeyframeOptions {
  prompt: string;
  faceImageUrl: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | undefined;
  idWeight?: number | undefined; // PuLID identity strength (0.0-1.0), default 0.8
  negativePrompt?: string | undefined;
  numInferenceSteps?: number | undefined;
  guidanceScale?: number | undefined;
  seed?: number | undefined;
}

export interface FalPulidKeyframeResult {
  imageUrl: string;
  model: string;
  aspectRatio: string;
  idWeight: number;
  prompt: string;
  seed?: number | undefined;
}

interface FalQueueUpdate {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: Array<{ message: string }>;
}

interface FalImageOutput {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalPulidResponse {
  images?: FalImageOutput[];
  image?: FalImageOutput;
  seed?: number;
  has_nsfw_concepts?: boolean[];
}

// Aspect ratio to dimensions mapping for Flux
const ASPECT_RATIO_DIMENSIONS = {
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
} as const satisfies Record<string, { width: number; height: number }>;

type AspectRatio = keyof typeof ASPECT_RATIO_DIMENSIONS;

const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';
const DEFAULT_DIMENSIONS = ASPECT_RATIO_DIMENSIONS[DEFAULT_ASPECT_RATIO];
const DEFAULT_ID_WEIGHT = 0.8;
const DEFAULT_GUIDANCE_SCALE = 7.5;
const DEFAULT_NUM_STEPS = 28;
const DEFAULT_NEGATIVE_PROMPT = 'blurry, low quality, distorted face, deformed, ugly, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limbs';

// fal.ai PuLID model endpoint
const FAL_PULID_MODEL = 'fal-ai/flux-pulid';

export class FalPulidKeyframeProvider {
  private readonly apiKey: string | null;
  private readonly log = logger.child({ service: 'FalPulidKeyframeProvider' });

  constructor(options: { apiKey?: string } = {}) {
    this.apiKey = resolveFalApiKey(options.apiKey);
  }

  public isAvailable(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Generate a face-consistent keyframe using Flux + PuLID
   */
  public async generateKeyframe(options: FalPulidKeyframeOptions): Promise<FalPulidKeyframeResult> {
    if (!this.apiKey) {
      throw new Error('Fal.ai provider is not configured. Set FAL_KEY or FAL_API_KEY.');
    }

    if (!options.faceImageUrl) {
      throw new Error('Face reference image URL is required');
    }

    const operation = 'generateKeyframe';
    const startTime = performance.now();
    const aspectRatio = options.aspectRatio ?? DEFAULT_ASPECT_RATIO;
    const dimensions = (aspectRatio in ASPECT_RATIO_DIMENSIONS)
      ? ASPECT_RATIO_DIMENSIONS[aspectRatio as AspectRatio]
      : DEFAULT_DIMENSIONS;
    const idWeight = options.idWeight ?? DEFAULT_ID_WEIGHT;

    const input = {
      prompt: this.enhancePromptForKeyframe(options.prompt),
      reference_images: [options.faceImageUrl],
      id_weight: idWeight,
      width: dimensions.width,
      height: dimensions.height,
      num_inference_steps: options.numInferenceSteps ?? DEFAULT_NUM_STEPS,
      guidance_scale: options.guidanceScale ?? DEFAULT_GUIDANCE_SCALE,
      negative_prompt: options.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
      ...(options.seed !== undefined && { seed: options.seed }),
    };

    this.log.info('Generating PuLID keyframe', {
      operation,
      promptLength: options.prompt.length,
      aspectRatio,
      idWeight,
      dimensions,
      hasNegativePrompt: Boolean(options.negativePrompt),
      hasSeed: options.seed !== undefined,
    });

    try {
      const result = await this.callFalApi<FalPulidResponse>(FAL_PULID_MODEL, input);
      const durationMs = Math.round(performance.now() - startTime);

      const imageUrl = this.extractImageUrl(result);
      if (!imageUrl) {
        throw new Error('PuLID generation returned no output image');
      }

      let imageHost: string | undefined;
      try {
        imageHost = new URL(imageUrl).host;
      } catch {
        imageHost = undefined;
      }

      this.log.info('PuLID keyframe generated successfully', {
        operation,
        ...(imageHost ? { imageHost } : {}),
        durationMs,
        seed: result.seed,
        aspectRatio,
        idWeight,
      });

      return {
        imageUrl,
        model: FAL_PULID_MODEL,
        aspectRatio,
        idWeight,
        prompt: options.prompt,
        seed: result.seed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('PuLID keyframe generation failed', error as Error, {
        operation,
        durationMs: Math.round(performance.now() - startTime),
        promptLength: options.prompt.length,
        aspectRatio,
        idWeight,
      });
      throw new Error(`PuLID keyframe generation failed: ${errorMessage}`);
    }
  }

  /**
   * Generate multiple keyframe variations with different identity weights
   */
  public async generateKeyframeOptions(
    options: FalPulidKeyframeOptions & { count?: number }
  ): Promise<FalPulidKeyframeResult[]> {
    const count = options.count ?? 3;
    const baseIdWeight = options.idWeight ?? DEFAULT_ID_WEIGHT;

    // Generate variations with different ID weights (0.6, 0.8, 1.0 typical range)
    const variations = Array.from({ length: count }, (_, index) => {
      const idWeight = Math.min(1.0, Math.max(0.4, baseIdWeight - 0.2 + (index * 0.2)));
      return this.generateKeyframe({
        ...options,
        idWeight,
      });
    });

    return Promise.all(variations);
  }

  /**
   * Call the fal.ai API with queue support
   */
  private async callFalApi<T>(model: string, input: Record<string, unknown>): Promise<T> {
    const operation = 'callFalApi';
    const baseUrl = 'https://queue.fal.run';
    const submitUrl = `${baseUrl}/${model}`;

    // Submit the request
    const submitResponse = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Fal API submission failed (${submitResponse.status}): ${errorText}`);
    }

    const submitResult = await submitResponse.json() as { request_id: string; status_url: string; response_url: string };
    const { request_id, status_url, response_url } = submitResult;

    this.log.debug('Fal request submitted', { operation, model, requestId: request_id });

    // Poll for completion
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 2000; // 2 seconds
    const endTime = Date.now() + maxWaitTime;

    while (Date.now() < endTime) {
      const statusResponse = await fetch(status_url, {
        headers: { 'Authorization': `Key ${this.apiKey}` },
      });

      if (!statusResponse.ok) {
        throw new Error(`Fal status check failed: ${statusResponse.status}`);
      }

      const status = await statusResponse.json() as FalQueueUpdate & { error?: string };

      if (status.status === 'COMPLETED') {
        // Fetch the result
        const resultResponse = await fetch(response_url, {
          headers: { 'Authorization': `Key ${this.apiKey}` },
        });

        if (!resultResponse.ok) {
          throw new Error(`Fal result fetch failed: ${resultResponse.status}`);
        }

        return await resultResponse.json() as T;
      }

      if (status.status === 'FAILED') {
        throw new Error(`Fal generation failed: ${status.error || 'Unknown error'}`);
      }

      // Log progress
      if (status.logs && status.logs.length > 0) {
        const lastLog = status.logs[status.logs.length - 1];
        if (lastLog) {
          this.log.debug('Fal progress', { operation, requestId: request_id, message: lastLog.message });
        }
      }

      await this.sleep(pollInterval);
    }

    throw new Error('Fal generation timed out');
  }

  private enhancePromptForKeyframe(prompt: string): string {
    const qualityTerms = ['high quality', '4k', 'detailed', 'sharp focus', 'professional'];
    const hasQuality = qualityTerms.some(term => prompt.toLowerCase().includes(term));

    if (hasQuality) {
      return prompt;
    }

    return `${prompt}, high quality, detailed, sharp focus, professional lighting`;
  }

  private extractImageUrl(result: FalPulidResponse): string | null {
    // Check for images array (common format)
    if (result.images && Array.isArray(result.images) && result.images.length > 0) {
      const firstImage = result.images[0];
      return firstImage?.url ?? null;
    }

    // Check for single image object
    if (result.image && result.image.url) {
      return result.image.url;
    }

    return null;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default FalPulidKeyframeProvider;
