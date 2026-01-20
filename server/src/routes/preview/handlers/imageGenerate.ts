import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { resolveImagePreviewProviderSelection } from '@services/image-generation/providers/registry';
import type {
  ImagePreviewProviderSelection,
  ImagePreviewSpeedMode,
} from '@services/image-generation/providers/types';
import { getAuthenticatedUserId } from '../auth';

type ImageGenerateServices = Pick<PreviewRoutesServices, 'imageGenerationService' | 'userCreditService'>;

const IMAGE_PREVIEW_CREDIT_COST = 1;

const SPEED_MODE_OPTIONS = new Set<ImagePreviewSpeedMode>([
  'Lightly Juiced',
  'Juiced',
  'Extra Juiced',
  'Real Time',
]);

export const createImageGenerateHandler = ({
  imageGenerationService,
  userCreditService,
}: ImageGenerateServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!imageGenerationService) {
      return res.status(503).json({
        success: false,
        error: 'Image generation service is not available',
        message: 'No image preview providers are configured',
      });
    }

    const { prompt, aspectRatio, provider, inputImageUrl, seed, speedMode, outputQuality } =
      (req.body || {}) as {
        prompt?: unknown;
        aspectRatio?: unknown;
        provider?: unknown;
        inputImageUrl?: unknown;
        seed?: unknown;
        speedMode?: unknown;
        outputQuality?: unknown;
      };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt must be a non-empty string',
      });
    }

    if (aspectRatio !== undefined && typeof aspectRatio !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'aspectRatio must be a string',
      });
    }

    let resolvedProvider: ImagePreviewProviderSelection | undefined;
    if (provider !== undefined) {
      if (typeof provider !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'provider must be a string',
        });
      }
      const selection = resolveImagePreviewProviderSelection(provider);
      if (!selection) {
        return res.status(400).json({
          success: false,
          error: `Unsupported provider: ${provider}`,
        });
      }
      resolvedProvider = selection;
    }

    let normalizedInputImageUrl: string | undefined;
    if (inputImageUrl !== undefined) {
      if (typeof inputImageUrl !== 'string' || inputImageUrl.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'inputImageUrl must be a non-empty string',
        });
      }
      normalizedInputImageUrl = inputImageUrl.trim();
    }

    let normalizedSeed: number | undefined;
    if (seed !== undefined) {
      if (typeof seed !== 'number' || !Number.isFinite(seed)) {
        return res.status(400).json({
          success: false,
          error: 'seed must be a finite number',
        });
      }
      normalizedSeed = seed;
    }

    let normalizedSpeedMode: ImagePreviewSpeedMode | undefined;
    if (speedMode !== undefined) {
      if (typeof speedMode !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'speedMode must be a string',
        });
      }
      if (!SPEED_MODE_OPTIONS.has(speedMode as ImagePreviewSpeedMode)) {
        return res.status(400).json({
          success: false,
          error: 'speedMode must be one of: Lightly Juiced, Juiced, Extra Juiced, Real Time',
        });
      }
      normalizedSpeedMode = speedMode as ImagePreviewSpeedMode;
    }

    let normalizedOutputQuality: number | undefined;
    if (outputQuality !== undefined) {
      if (typeof outputQuality !== 'number' || !Number.isFinite(outputQuality)) {
        return res.status(400).json({
          success: false,
          error: 'outputQuality must be a finite number',
        });
      }
      normalizedOutputQuality = outputQuality;
    }

    if (resolvedProvider === 'replicate-flux-kontext-fast' && !normalizedInputImageUrl) {
      return res.status(400).json({
        success: false,
        error:
          'inputImageUrl is required when using the replicate-flux-kontext-fast provider',
      });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to generate image previews.',
      });
    }

    if (!userCreditService) {
      logger.error('User credit service is not available - blocking preview access', undefined, {
        path: req.path,
      });
      return res.status(503).json({
        success: false,
        error: 'Image generation service is not available',
        message: 'Credit service is not configured',
      });
    }

    const previewCost = IMAGE_PREVIEW_CREDIT_COST;
    const hasCredits = await userCreditService.reserveCredits(userId, previewCost);
    if (!hasCredits) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `This preview requires ${previewCost} credit${previewCost === 1 ? '' : 's'}.`,
      });
    }

    try {
      const result = await imageGenerationService.generatePreview(prompt, {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(userId ? { userId } : {}),
        ...(resolvedProvider ? { provider: resolvedProvider } : {}),
        ...(normalizedInputImageUrl ? { inputImageUrl: normalizedInputImageUrl } : {}),
        ...(normalizedSeed !== undefined ? { seed: normalizedSeed } : {}),
        ...(normalizedSpeedMode ? { speedMode: normalizedSpeedMode } : {}),
        ...(normalizedOutputQuality !== undefined
          ? { outputQuality: normalizedOutputQuality }
          : {}),
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      await userCreditService.refundCredits(userId, previewCost);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);

      logger.error('Image preview generation failed', errorInstance, {
        statusCode,
        userId,
        aspectRatio,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Image generation failed',
        message: errorMessage,
      });
    }
  };
