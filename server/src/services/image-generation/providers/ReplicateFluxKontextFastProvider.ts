/**
 * Replicate Flux Kontext Fast provider
 *
 * Supports prompt cleanup, optional video-to-image transformation,
 * and Replicate polling for Flux Kontext Fast preview images.
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import { sleep as sleepForMs } from '@utils/sleep';
import { stripPreviewSections } from '@services/image-generation/promptSanitization';
import type {
  ImagePreviewProvider,
  ImagePreviewRequest,
  ImagePreviewResult,
  ImagePreviewSpeedMode,
} from './types';
import { VideoToImagePromptTransformer } from './VideoToImagePromptTransformer';

interface ReplicateClient {
  predictions: {
    create: (params: {
      model: string;
      input: {
        prompt: string;
        aspect_ratio: string;
        output_format: string;
        output_quality: number;
        speed_mode?: string;
        seed?: number;
        img_cond_path?: string;
      };
    }) => Promise<ReplicatePrediction>;
    get: (id: string) => Promise<ReplicatePrediction>;
  };
}

type ReplicatePredictionInput = Parameters<ReplicateClient['predictions']['create']>[0]['input'];

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null | undefined;
  error?: string | null;
  logs?: string | null;
}

const KONTEXT_MODEL_ID = 'prunaai/flux-kontext-fast';

const KONTEXT_ASPECT_RATIOS = [
  'match_input_image',
  '1:1',
  '16:9',
  '21:9',
  '3:2',
  '2:3',
  '4:5',
  '5:4',
  '3:4',
  '4:3',
  '9:16',
  '9:21',
] as const;

type KontextAspectRatio = (typeof KONTEXT_ASPECT_RATIOS)[number];

const DEFAULT_ASPECT_RATIO: KontextAspectRatio = '16:9';
const KONTEXT_ASPECT_RATIO_SET = new Set<string>(KONTEXT_ASPECT_RATIOS);

const SPEED_MODE_MAP: Record<ImagePreviewSpeedMode, string> = {
  'Lightly Juiced': 'Lightly Juiced \ud83c\udf4a (more consistent)',
  'Juiced': 'Juiced \ud83d\udd25 (default)',
  'Extra Juiced': 'Extra Juiced \ud83d\udd25 (more speed)',
  'Real Time': 'Real Time',
};

const DEFAULT_SPEED_MODE = SPEED_MODE_MAP['Juiced'];
const DEFAULT_OUTPUT_QUALITY = 80;
const MAX_CREATE_RETRIES = 2;
const DEFAULT_RETRY_AFTER_MS = 4000;

const isKontextAspectRatio = (value: string): value is KontextAspectRatio =>
  KONTEXT_ASPECT_RATIO_SET.has(value);

const normalizeAspectRatio = (
  value?: string,
  useInputImage?: boolean
): KontextAspectRatio => {
  if (!value) {
    return useInputImage ? 'match_input_image' : DEFAULT_ASPECT_RATIO;
  }

  const trimmed = value.trim();
  return isKontextAspectRatio(trimmed)
    ? trimmed
    : useInputImage
      ? 'match_input_image'
      : DEFAULT_ASPECT_RATIO;
};

const normalizeOutputQuality = (value?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_OUTPUT_QUALITY;
  }

  const rounded = Math.round(value);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 100) {
    return 100;
  }
  return rounded;
};

const normalizeSeed = (value?: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value);
};

interface VideoPromptDetector {
  isVideoPrompt(prompt: string | null | undefined): boolean;
}

export interface ReplicateFluxKontextFastProviderOptions {
  apiToken?: string;
  promptTransformer?: VideoToImagePromptTransformer | null;
  videoPromptDetector?: VideoPromptDetector;
}

export class ReplicateFluxKontextFastProvider implements ImagePreviewProvider {
  public readonly id = 'replicate-flux-kontext-fast' as const;
  public readonly displayName = 'Replicate Flux Kontext Fast';

  private readonly replicate: ReplicateClient | null;
  private readonly promptTransformer: VideoToImagePromptTransformer | null;
  private readonly videoPromptDetector: VideoPromptDetector;
  private readonly log = logger.child({ service: 'ReplicateFluxKontextFastProvider' });

  constructor(options: ReplicateFluxKontextFastProviderOptions = {}) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;
    this.replicate = apiToken
      ? (new Replicate({
          auth: apiToken,
        }) as ReplicateClient)
      : null;

    this.promptTransformer = options.promptTransformer ?? null;
    if (!options.videoPromptDetector) {
      throw new Error('ReplicateFluxKontextFastProvider requires a videoPromptDetector');
    }
    this.videoPromptDetector = options.videoPromptDetector;
  }

  public isAvailable(): boolean {
    return this.replicate !== null;
  }

  public async generatePreview(request: ImagePreviewRequest): Promise<ImagePreviewResult> {
    if (!this.replicate) {
      throw new Error(
        'Replicate provider is not configured. REPLICATE_API_TOKEN is required.'
      );
    }

    const trimmedPrompt = request.prompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const userId = request.userId;
    const hasInputImage =
      typeof request.inputImageUrl === 'string' && request.inputImageUrl.trim().length > 0;

    if (!hasInputImage) {
      const missingInputError = new Error(
        'Flux Kontext Fast requires inputImageUrl for img2img edits. Generate a base image first.'
      ) as Error & { statusCode?: number };
      missingInputError.statusCode = 400;
      throw missingInputError;
    }

    const aspectRatio = normalizeAspectRatio(request.aspectRatio, hasInputImage);
    const cleanedPrompt = stripPreviewSections(trimmedPrompt);

    let promptForModel = cleanedPrompt;
    let promptWasTransformed = false;

    const disablePromptTransformation = request.disablePromptTransformation === true;
    if (!disablePromptTransformation && this.promptTransformer && this.shouldTransformPrompt(cleanedPrompt)) {
      try {
        promptForModel = await this.promptTransformer.transform(cleanedPrompt);
        promptWasTransformed = promptForModel !== cleanedPrompt;
      } catch (error) {
        this.log.warn('Prompt transformation failed, using original', {
          error: error instanceof Error ? error.message : String(error),
          userId,
        });
      }
    } else if (this.promptTransformer) {
      this.log.debug('Skipping video-to-image prompt transformation', {
        promptPreview: cleanedPrompt.substring(0, 100),
        userId,
        disabled: disablePromptTransformation,
      });
    }

    const speedMode = request.speedMode ? SPEED_MODE_MAP[request.speedMode] : DEFAULT_SPEED_MODE;
    const outputQuality = normalizeOutputQuality(request.outputQuality);
    const seed = normalizeSeed(request.seed);

    this.log.info('Generating image preview', {
      prompt: promptForModel.substring(0, 100),
      promptWasTransformed,
      aspectRatio,
      speedMode,
      outputQuality,
      hasInputImage,
      promptWasStripped: cleanedPrompt !== trimmedPrompt,
      userId,
    });

    try {
      const startTime = Date.now();

      const input: ReplicatePredictionInput = {
        prompt: promptForModel,
        aspect_ratio: aspectRatio,
        output_format: 'webp',
        output_quality: outputQuality,
        speed_mode: speedMode,
      };

      if (seed !== undefined) {
        input.seed = seed;
      }
      const inputImageUrl = request.inputImageUrl?.trim();
      if (hasInputImage && inputImageUrl) {
        input.img_cond_path = inputImageUrl;
      }

      const prediction = await this.createPrediction(input, userId);

      this.log.info('Prediction created', {
        predictionId: prediction.id,
        status: prediction.status,
        userId,
      });

      const maxWaitTime = 60000; // 60 seconds max
      const pollInterval = 1000; // Poll every second
      const endTime = Date.now() + maxWaitTime;
      let currentPrediction = prediction;

      while (Date.now() < endTime) {
        if (currentPrediction.status === 'succeeded') {
          break;
        }
        if (currentPrediction.status === 'failed' || currentPrediction.status === 'canceled') {
          const predictionError = new Error(
            `Image generation failed: ${currentPrediction.error || 'Unknown error'}`
          );
          this.log.error('Prediction failed', predictionError, {
            predictionId: currentPrediction.id,
            status: currentPrediction.status,
            error: currentPrediction.error,
            logs: currentPrediction.logs,
            userId,
          });
          throw predictionError;
        }

        await this.sleep(pollInterval);
        currentPrediction = await this.replicate.predictions.get(prediction.id);

        this.log.debug('Polling prediction', {
          predictionId: currentPrediction.id,
          status: currentPrediction.status,
          userId,
        });
      }

      if (currentPrediction.status !== 'succeeded') {
        throw new Error(
          `Prediction timed out or failed. Status: ${currentPrediction.status}`
        );
      }

      const output = currentPrediction.output;
      const durationMs = Date.now() - startTime;

      if (output === null || output === undefined) {
        const outputError = new Error(
          'Replicate API returned no output. The image generation may have failed silently.'
        );
        this.log.error('Replicate API returned null/undefined output', outputError, {
          userId,
          duration: durationMs,
        });
        throw outputError;
      }

      this.log.info('Replicate API response received', {
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputLength: Array.isArray(output) ? output.length : null,
        outputPreview: JSON.stringify(output, null, 2).substring(0, 1000),
        userId,
      });

      const imageUrl = this.extractImageUrl(output, userId);

      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        const urlError = new Error('Invalid image URL format returned from Replicate API');
        this.log.error('Invalid URL format returned', urlError, {
          imageUrl: imageUrl.substring(0, 100),
          userId,
        });
        throw urlError;
      }

      this.log.info('Image preview generated successfully', {
        imageUrl: imageUrl.substring(0, 100),
        duration: durationMs,
        promptWasTransformed,
        userId,
      });

      return {
        imageUrl,
        model: KONTEXT_MODEL_ID,
        durationMs,
        aspectRatio,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let parsedError = errorMessage;
      let statusCode = 500;

      if (errorMessage.includes('402') || errorMessage.includes('Insufficient credit')) {
        statusCode = 402;
        parsedError = this.parseReplicateErrorDetail(
          errorMessage,
          'Insufficient credit. Please add payment method to your Replicate account.'
        );
      } else if (
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('throttled')
      ) {
        statusCode = 429;
        parsedError = this.parseReplicateErrorDetail(
          errorMessage,
          'Rate limit exceeded. Please wait a moment and try again.'
        );
      }

      this.log.error(
        'Image generation failed',
        error instanceof Error ? error : new Error(errorMessage),
        {
          parsedError,
          statusCode,
          prompt: promptForModel.substring(0, 100),
          promptWasTransformed,
          userId,
        }
      );

      const enhancedError = new Error(parsedError) as Error & { statusCode?: number };
      enhancedError.statusCode = statusCode;
      throw enhancedError;
    }
  }

  private async createPrediction(
    input: ReplicatePredictionInput,
    userId: string
  ): Promise<ReplicatePrediction> {
    if (!this.replicate) {
      throw new Error(
        'Replicate provider is not configured. REPLICATE_API_TOKEN is required.'
      );
    }

    for (let attempt = 0; attempt <= MAX_CREATE_RETRIES; attempt += 1) {
      try {
        return await this.replicate.predictions.create({
          model: KONTEXT_MODEL_ID,
          input,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const retryAfterMs = this.parseRetryAfterMs(errorMessage);
        const isRateLimitError =
          retryAfterMs !== null || /429|throttled|rate limit/i.test(errorMessage);

        if (!isRateLimitError || attempt >= MAX_CREATE_RETRIES) {
          throw error;
        }

        const delayMs = retryAfterMs ?? DEFAULT_RETRY_AFTER_MS;
        this.log.warn('Replicate rate limit encountered, retrying create prediction', {
          attempt: attempt + 1,
          delayMs,
          userId,
        });
        await this.sleep(delayMs);
      }
    }

    throw new Error('Replicate create prediction failed after retries');
  }

  private parseRetryAfterMs(message: string): number | null {
    try {
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]) as {
          retry_after?: number | string;
          retry_after_ms?: number | string;
        };
        if (errorData.retry_after_ms !== undefined) {
          const value =
            typeof errorData.retry_after_ms === 'string'
              ? Number.parseFloat(errorData.retry_after_ms)
              : errorData.retry_after_ms;
          return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
        }
        if (errorData.retry_after !== undefined) {
          const value =
            typeof errorData.retry_after === 'string'
              ? Number.parseFloat(errorData.retry_after)
              : errorData.retry_after;
          return Number.isFinite(value) ? Math.max(0, Math.round(value * 1000)) : null;
        }
      }
    } catch {
      return null;
    }

    const match = message.match(/retry_after[^0-9]*(\d+(?:\.\d+)?)/i);
    if (match?.[1]) {
      const seconds = Number.parseFloat(match[1]);
      return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : null;
    }

    return null;
  }

  private async sleep(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms <= 0) {
      return;
    }
    await sleepForMs(ms);
  }

  private parseReplicateErrorDetail(message: string, fallback: string): string {
    try {
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]) as {
          detail?: string;
          title?: string;
        };
        return errorData.detail || errorData.title || fallback;
      }
    } catch {
      return fallback;
    }

    return fallback;
  }

  private extractImageUrl(output: unknown, userId: string): string {
    let imageUrl: string | null = null;

    if (typeof output === 'string') {
      imageUrl = output;
    } else if (Array.isArray(output)) {
      const stringUrl = output.find(
        (item): item is string =>
          typeof item === 'string' &&
          (item.startsWith('http://') || item.startsWith('https://'))
      );

      if (stringUrl) {
        imageUrl = stringUrl;
      } else {
        for (const item of output) {
          if (item && typeof item === 'object') {
            const itemObj = item as Record<string, unknown>;
            const urlFromObject =
              itemObj.url ||
              itemObj.imageUrl ||
              itemObj.output ||
              itemObj.src ||
              (Array.isArray(itemObj.urls) ? itemObj.urls[0] : null) ||
              (Array.isArray(itemObj.files) ? itemObj.files[0] : null);

            if (
              urlFromObject &&
              typeof urlFromObject === 'string' &&
              (urlFromObject.startsWith('http://') ||
                urlFromObject.startsWith('https://'))
            ) {
              imageUrl = urlFromObject;
              break;
            }
          }
        }

        if (!imageUrl && output.length === 1 && typeof output[0] === 'object') {
          const firstItem = output[0] as Record<string, unknown>;
          const keys = Object.keys(firstItem);

          this.log.warn('Array contains object but no URL found', {
            objectKeys: keys,
            objectValue: JSON.stringify(firstItem, null, 2).substring(0, 500),
            userId,
          });
        }
      }
    } else if (output && typeof output === 'object') {
      const outputObj = output as Record<string, unknown>;

      if ('status' in outputObj) {
        if (outputObj.status === 'succeeded' && outputObj.output) {
          if (typeof outputObj.output === 'string') {
            imageUrl = outputObj.output;
          } else if (Array.isArray(outputObj.output)) {
            const url =
              outputObj.output.find(
                (item) =>
                  typeof item === 'string' &&
                  (item.startsWith('http://') || item.startsWith('https://'))
              ) || outputObj.output[0];
            imageUrl = typeof url === 'string' ? url : null;
          }
        } else if (outputObj.status !== 'succeeded') {
          throw new Error(
            `Image generation failed with status: ${outputObj.status}${outputObj.error ? '. ' + outputObj.error : ''}`
          );
        }
      }

      if (!imageUrl) {
        const url =
          outputObj.url ||
          outputObj.imageUrl ||
          outputObj.output ||
          (Array.isArray(outputObj.files) ? outputObj.files[0] : null) ||
          (outputObj.urls && Array.isArray(outputObj.urls)
            ? outputObj.urls[0]
            : null);
        imageUrl = typeof url === 'string' ? url : null;
      }
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      const errorDetails: Record<string, unknown> = {
        output: JSON.stringify(output, null, 2).substring(0, 2000),
        outputType: typeof output,
        isArray: Array.isArray(output),
        userId,
      };

      this.log.error(
        'Unexpected Replicate response format',
        new Error('Unexpected Replicate response format'),
        errorDetails
      );

      if (
        Array.isArray(output) &&
        output.length > 0 &&
        typeof output[0] === 'object' &&
        Object.keys(output[0]).length === 0
      ) {
        throw new Error(
          'Replicate API returned an empty response. The image generation may have failed or the model is still processing. Please try again.'
        );
      }

      throw new Error('Invalid response from Replicate API: no image URL returned.');
    }

    return imageUrl;
  }

  private shouldTransformPrompt(prompt: string): boolean {
    if (this.videoPromptDetector.isVideoPrompt(prompt)) {
      return true;
    }

    const normalized = prompt.toLowerCase();
    const temporalPatterns: RegExp[] = [
      /\b(?:pan|pans|panning|tilt|tilts|tilting|dolly|dollies|dolly\s*(?:in|out)|push\s*(?:in|out)|pull\s*(?:in|out)|zoom|zooms|zooming|crane|cranes|crane\s*(?:up|down)|tracking|truck|trucking|orbit|arc|sweep|whip\s*pan|rack\s*focus|focus\s*pull)\b/i,
      /\b(?:cut\s*to|fade\s*(?:in|out)|dissolve|montage|sequence|storyboard|shot\s*\d+)\b/i,
      /\b(?:duration|seconds?|secs?|fps|frame\s*rate|time-?lapse|timelapse)\b/i,
      /\b\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds)\b/i,
    ];

    return temporalPatterns.some((pattern) => pattern.test(normalized));
  }
}
