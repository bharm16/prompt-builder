/**
 * FalFaceSwapProvider
 *
 * Face-swap preprocessing using Easel AI on fal.ai.
 * Composites a character's face onto a target composition image.
 */

import { z, type ZodSchema } from 'zod';
import { logger } from '@infrastructure/Logger';
import { resolveFalApiKey } from '@utils/falApiKey';
import { sleep } from '@utils/sleep';
import { assertUrlSafe } from '@server/shared/urlValidation';

export interface FaceSwapOptions {
  faceImageUrl: string;
  targetImageUrl: string;
  preserveHair?: 'user' | 'target';
  upscale?: boolean;
  gender?: 'male' | 'female' | 'non-binary';
}

export interface FaceSwapResult {
  imageUrl: string;
  width: number;
  height: number;
  contentType: string;
}

const FAL_QUEUE_STATUS_SCHEMA = z.enum(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED']);

const FAL_QUEUE_LOG_SCHEMA = z.object({
  message: z.string().optional(),
}).passthrough();

const FAL_QUEUE_ERROR_SCHEMA = z.object({
  message: z.string().optional(),
}).passthrough();

const FAL_QUEUE_UPDATE_SCHEMA = z.object({
  status: FAL_QUEUE_STATUS_SCHEMA,
  logs: z.array(FAL_QUEUE_LOG_SCHEMA).nullable().optional(),
  error: z.union([z.string(), FAL_QUEUE_ERROR_SCHEMA]).nullable().optional(),
});

const FAL_IMAGE_OUTPUT_SCHEMA = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  content_type: z.string().optional(),
});

const FAL_FACE_SWAP_RESPONSE_SCHEMA = z.object({
  image: FAL_IMAGE_OUTPUT_SCHEMA.optional(),
  images: z.array(FAL_IMAGE_OUTPUT_SCHEMA).optional(),
});

const FAL_SUBMIT_RESPONSE_SCHEMA = z.object({
  request_id: z.string(),
  status_url: z.string(),
  response_url: z.string(),
});

const FAL_FACE_SWAP_MODEL = 'easel-ai/advanced-face-swap';

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(invalid-url)';
  }
}
const DEFAULT_PRESERVE_HAIR: FaceSwapOptions['preserveHair'] = 'user';
const DEFAULT_UPSCALE = true;

export class FalFaceSwapProvider {
  private readonly apiKey: string | null;
  private readonly log = logger.child({ service: 'FalFaceSwapProvider' });

  constructor(options: { apiKey?: string } = {}) {
    this.apiKey = resolveFalApiKey(options.apiKey);
  }

  public isAvailable(): boolean {
    return this.apiKey !== null;
  }

  public async swapFace(options: FaceSwapOptions): Promise<FaceSwapResult> {
    if (!this.apiKey) {
      throw new Error('Fal.ai provider is not configured. Set FAL_KEY or FAL_API_KEY.');
    }

    if (!options.faceImageUrl) {
      throw new Error('Face reference image URL is required');
    }

    if (!options.targetImageUrl) {
      throw new Error('Target composition image URL is required');
    }

    this.ensureUrlSafe(options.faceImageUrl, 'faceImageUrl');
    this.ensureUrlSafe(options.targetImageUrl, 'targetImageUrl');

    const operation = 'swapFace';
    const startTime = performance.now();
    const preserveHair = options.preserveHair ?? DEFAULT_PRESERVE_HAIR;
    const workflowType = preserveHair === 'target' ? 'target_hair' : 'user_hair';
    const upscale = options.upscale ?? DEFAULT_UPSCALE;

    const input: Record<string, unknown> = {
      face_image_0: options.faceImageUrl,
      target_image: options.targetImageUrl,
      workflow_type: workflowType,
      upscale,
      gender_0: options.gender ?? 'female',
    };

    this.log.info('Submitting face swap to fal.ai', {
      operation,
      model: FAL_FACE_SWAP_MODEL,
      preserveHair,
      workflowType,
      upscale,
      gender: options.gender ?? 'female (default)',
      faceImageHost: safeHost(options.faceImageUrl),
      targetImageHost: safeHost(options.targetImageUrl),
    });

    try {
      const result = await this.callFalApi(FAL_FACE_SWAP_MODEL, input, FAL_FACE_SWAP_RESPONSE_SCHEMA);
      const durationMs = Math.round(performance.now() - startTime);

      const image = this.extractImage(result);
      if (!image?.url) {
        throw new Error('Face swap returned no output image');
      }

      let imageHost: string | undefined;
      try {
        imageHost = new URL(image.url).host;
      } catch {
        imageHost = undefined;
      }

      this.log.info('Face swap completed', {
        operation,
        ...(imageHost ? { imageHost } : {}),
        durationMs,
      });

      return {
        imageUrl: image.url,
        width: image.width ?? 0,
        height: image.height ?? 0,
        contentType: image.content_type ?? 'image/*',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Face swap failed', error as Error, {
        operation,
        durationMs: Math.round(performance.now() - startTime),
        preserveHair,
        upscale,
      });
      // TODO: Remove after debugging Fal 500 — temporary diagnostic URLs
      this.log.warn('Face swap debug: input URLs on failure', {
        faceImageUrl: options.faceImageUrl,
        targetImageUrl: options.targetImageUrl,
      });
      throw new Error(`Face swap failed: ${errorMessage}`);
    }
  }

  private ensureUrlSafe(url: string, fieldName: string): void {
    assertUrlSafe(url, fieldName);
  }

  private async callFalApi<T>(
    model: string,
    input: Record<string, unknown>,
    resultSchema: ZodSchema<T>
  ): Promise<T> {
    const operation = 'callFalApi';
    const baseUrl = 'https://queue.fal.run';
    const submitUrl = `${baseUrl}/${model}`;

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

    const submitJson: unknown = await submitResponse.json();
    const submitResult = FAL_SUBMIT_RESPONSE_SCHEMA.parse(submitJson);
    const { request_id, status_url, response_url } = submitResult;

    this.log.debug('Fal request submitted', { operation, model, requestId: request_id });

    const maxWaitTime = 120000;
    const pollInterval = 2000;
    const endTime = Date.now() + maxWaitTime;

    while (Date.now() < endTime) {
      const statusResponse = await fetch(status_url, {
        headers: { 'Authorization': `Key ${this.apiKey}` },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Fal status check failed (${statusResponse.status}): ${errorText}`);
      }

      const statusJson: unknown = await statusResponse.json();
      const status = FAL_QUEUE_UPDATE_SCHEMA.parse(statusJson);

      const falLogs = status.logs?.map((l) => l.message).filter(Boolean) ?? [];

      if (status.status === 'COMPLETED') {
        const resultResponse = await fetch(response_url, {
          headers: { 'Authorization': `Key ${this.apiKey}` },
        });

        if (!resultResponse.ok) {
          const errorText = await resultResponse.text();
          this.log.error('Fal result fetch failed after COMPLETED status', undefined, {
            operation,
            requestId: request_id,
            resultStatus: resultResponse.status,
            resultBody: errorText,
            falLogs,
          });
          throw new Error(`Fal result fetch failed (${resultResponse.status}): ${errorText}`);
        }

        const resultJson: unknown = await resultResponse.json();
        return resultSchema.parse(resultJson);
      }

      if (status.status === 'FAILED') {
        const errorMessage =
          typeof status.error === 'string'
            ? status.error
            : status.error?.message ?? 'Unknown error';
        this.log.error('Fal generation reported FAILED', undefined, {
          operation,
          requestId: request_id,
          falError: status.error,
          falLogs,
        });
        throw new Error(`Fal generation failed: ${errorMessage}`);
      }

      if (falLogs.length > 0) {
        this.log.debug('Fal progress', { operation, requestId: request_id, falLogs });
      }

      await sleep(pollInterval);
    }

    throw new Error('Fal generation timed out');
  }

  private extractImage(result: z.infer<typeof FAL_FACE_SWAP_RESPONSE_SCHEMA>) {
    if (result.images && result.images.length > 0) {
      return result.images[0];
    }

    if (result.image) {
      return result.image;
    }

    return null;
  }
}

export default FalFaceSwapProvider;
