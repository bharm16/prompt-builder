/**
 * Image Generation Service
 *
 * Handles image generation using Replicate's Flux Schnell model.
 * Provides low-fidelity preview images for prompt validation.
 *
 * Uses LLM-powered video-to-image transformation to convert temporal
 * video prompts into static image descriptions before generation.
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import { VideoPromptDetectionService } from '@services/video-prompt-analysis/services/detection/VideoPromptDetectionService';
import type {
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageGenerationServiceOptions,
} from './types';
import type { VideoToImagePromptTransformer } from './VideoToImagePromptTransformer';

interface ReplicateClient {
  predictions: {
    create: (params: {
      model: string;
      input: {
        prompt: string;
        aspect_ratio: string;
        output_format: string;
        output_quality: number;
      };
    }) => Promise<ReplicatePrediction>;
    get: (id: string) => Promise<ReplicatePrediction>;
  };
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null | undefined;
  error?: string | null;
  logs?: string | null;
}

/**
 * Image Generation Service
 * Wraps Replicate API calls for generating preview images
 */
export class ImageGenerationService {
  private readonly replicate: ReplicateClient | null;
  private readonly model: string;
  private readonly promptTransformer: VideoToImagePromptTransformer | null;
  private readonly videoPromptDetector: VideoPromptDetectionService;

  constructor(
    options: ImageGenerationServiceOptions = {},
    promptTransformer?: VideoToImagePromptTransformer | null
  ) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      logger.warn('REPLICATE_API_TOKEN not provided, image generation will be disabled');
      this.replicate = null;
    } else {
      this.replicate = new Replicate({
        auth: apiToken,
      }) as ReplicateClient;
    }

    // Flux Schnell model identifier
    this.model = 'black-forest-labs/flux-schnell';
    this.promptTransformer = promptTransformer ?? null;
    this.videoPromptDetector = new VideoPromptDetectionService();
  }

  /**
   * Generate a preview image from a prompt
   */
  async generatePreview(
    prompt: string | null | undefined,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    if (!this.replicate) {
      throw new Error(
        'Image generation service is not configured. REPLICATE_API_TOKEN is required.'
      );
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const { aspectRatio = '16:9', userId = 'anonymous' } = options;

    // Map aspect ratio to Replicate's format
    // Flux Schnell supports: "1:1", "16:9", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"
    const aspectRatioMap: Record<string, string> = {
      '16:9': '16:9',
      '1:1': '1:1',
      '21:9': '21:9',
      '2:3': '2:3',
      '3:2': '3:2',
      '4:5': '4:5',
      '5:4': '5:4',
      '9:16': '9:16',
      '9:21': '9:21',
    };

    const mappedAspectRatio = aspectRatioMap[aspectRatio] || '16:9';

    const trimmedPrompt = prompt.trim();
    const cleanedPrompt = this.stripPreviewSections(trimmedPrompt);

    // Transform video prompt to image prompt using LLM
    let promptForModel: string;
    let promptWasTransformed = false;

    const shouldTransform =
      !!this.promptTransformer && this.shouldTransformPrompt(cleanedPrompt);

    if (this.promptTransformer && shouldTransform) {
      try {
        promptForModel = await this.promptTransformer.transform(cleanedPrompt);
        promptWasTransformed = promptForModel !== cleanedPrompt;
      } catch (error) {
        // Fallback to original prompt if transformation fails
        logger.warn('Prompt transformation failed, using original', {
          error: error instanceof Error ? error.message : String(error),
          userId,
        });
        promptForModel = cleanedPrompt;
      }
    } else {
      if (this.promptTransformer) {
        logger.debug('Skipping video-to-image prompt transformation', {
          promptPreview: cleanedPrompt.substring(0, 100),
          userId,
        });
      }
      promptForModel = cleanedPrompt;
    }

    logger.info('Generating image preview', {
      prompt: promptForModel.substring(0, 100),
      promptWasTransformed,
      aspectRatio: mappedAspectRatio,
      promptWasStripped: cleanedPrompt !== trimmedPrompt,
      userId,
    });

    try {
      const startTime = Date.now();

      // Create the prediction
      const prediction = await this.replicate.predictions.create({
        model: this.model,
        input: {
          prompt: promptForModel,
          aspect_ratio: mappedAspectRatio,
          output_format: 'webp',
          output_quality: 80,
        },
      });

      logger.info('Prediction created', {
        predictionId: prediction.id,
        status: prediction.status,
        userId,
      });

      // Poll until completion (with timeout)
      const maxWaitTime = 60000; // 60 seconds max
      const pollInterval = 1000; // Poll every second
      const endTime = Date.now() + maxWaitTime;
      let currentPrediction = prediction;

      while (Date.now() < endTime) {
        if (currentPrediction.status === 'succeeded') {
          break;
        } else if (
          currentPrediction.status === 'failed' ||
          currentPrediction.status === 'canceled'
        ) {
          const predictionError = new Error(
            `Image generation failed: ${currentPrediction.error || 'Unknown error'}`
          );
          logger.error('Prediction failed', predictionError, {
            predictionId: currentPrediction.id,
            status: currentPrediction.status,
            error: currentPrediction.error,
            logs: currentPrediction.logs,
            userId,
          });
          throw predictionError;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        // Get updated prediction status
        currentPrediction = await this.replicate.predictions.get(prediction.id);

        logger.debug('Polling prediction', {
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
      const duration = Date.now() - startTime;

      // Check if output is null or undefined
      if (output === null || output === undefined) {
        const outputError = new Error(
          'Replicate API returned no output. The image generation may have failed silently.'
        );
        logger.error('Replicate API returned null/undefined output', outputError, {
          userId,
          duration,
        });
        throw outputError;
      }

      // Log the raw output for debugging
      logger.info('Replicate API response received', {
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputLength: Array.isArray(output) ? output.length : null,
        outputPreview: JSON.stringify(output, null, 2).substring(0, 1000),
        userId,
      });

      // Extract image URL from response
      const imageUrl = this.extractImageUrl(output, userId);

      // Validate URL format
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        const urlError = new Error(
          'Invalid image URL format returned from Replicate API'
        );
        logger.error('Invalid URL format returned', urlError, {
          imageUrl: imageUrl.substring(0, 100),
          userId,
        });
        throw urlError;
      }

      logger.info('Image preview generated successfully', {
        imageUrl: imageUrl.substring(0, 100),
        duration,
        promptWasTransformed,
        userId,
      });

      return {
        imageUrl,
        metadata: {
          aspectRatio: mappedAspectRatio,
          model: this.model,
          duration,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Parse Replicate API errors for better error messages
      let parsedError = errorMessage;
      let statusCode = 500;

      // Check for payment required (402)
      if (
        errorMessage.includes('402') ||
        errorMessage.includes('Insufficient credit')
      ) {
        statusCode = 402;
        try {
          const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]) as {
              detail?: string;
              title?: string;
            };
            parsedError =
              errorData.detail ||
              errorData.title ||
              'Insufficient credit. Please add payment method to your Replicate account.';
          } else {
            parsedError =
              'Insufficient credit. Please add payment method to your Replicate account.';
          }
        } catch {
          parsedError =
            'Insufficient credit. Please add payment method to your Replicate account.';
        }
      }
      // Check for rate limiting (429)
      else if (
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('throttled')
      ) {
        statusCode = 429;
        try {
          const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]) as { detail?: string };
            parsedError =
              errorData.detail ||
              'Rate limit exceeded. Please wait a moment and try again.';
          } else {
            parsedError =
              'Rate limit exceeded. Please wait a moment and try again.';
          }
        } catch {
          parsedError =
            'Rate limit exceeded. Please wait a moment and try again.';
        }
      }

      logger.error(
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

      const enhancedError = new Error(parsedError) as Error & {
        statusCode?: number;
      };
      enhancedError.statusCode = statusCode;
      throw enhancedError;
    }
  }

  /**
   * Extract image URL from Replicate response
   * Handles various response formats from different models
   */
  private extractImageUrl(output: unknown, userId: string): string {
    let imageUrl: string | null = null;

    if (typeof output === 'string') {
      imageUrl = output;
    } else if (Array.isArray(output)) {
      // Try to find a direct string URL
      const stringUrl = output.find((item) => {
        if (typeof item === 'string') {
          return item.startsWith('http://') || item.startsWith('https://');
        }
        return false;
      });

      if (stringUrl) {
        imageUrl = stringUrl as string;
      } else {
        // Check for objects with URL properties
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

        // Log warning for debugging
        if (!imageUrl && output.length === 1 && typeof output[0] === 'object') {
          const firstItem = output[0] as Record<string, unknown>;
          const keys = Object.keys(firstItem);

          logger.warn('Array contains object but no URL found', {
            objectKeys: keys,
            objectValue: JSON.stringify(firstItem, null, 2).substring(0, 500),
            userId,
          });
        }
      }
    } else if (output && typeof output === 'object') {
      const outputObj = output as Record<string, unknown>;

      // Check if it's a prediction object
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

      // Try other common fields
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

      logger.error(
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

      throw new Error(
        'Invalid response from Replicate API: no image URL returned.'
      );
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

  private stripPreviewSections(prompt: string): string {
    if (!prompt) {
      return prompt;
    }

    const markers: RegExp[] = [
      /\r?\n\s*\*\*\s*technical specs\s*\*\*/i,
      /\r?\n\s*\*\*\s*technical parameters\s*\*\*/i,
      /\r?\n\s*\*\*\s*alternative approaches\s*\*\*/i,
      /\r?\n\s*technical specs\s*[:\n]/i,
      /\r?\n\s*alternative approaches\s*[:\n]/i,
      /\r?\n\s*variation\s+\d+/i,
    ];

    let cutIndex = -1;
    for (const marker of markers) {
      const match = marker.exec(prompt);
      if (match && (cutIndex === -1 || match.index < cutIndex)) {
        cutIndex = match.index;
      }
    }

    const stripped = (cutIndex >= 0 ? prompt.slice(0, cutIndex) : prompt).trim();
    return stripped.length >= 10 ? stripped : prompt.trim();
  }
}
