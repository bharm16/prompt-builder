import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { resolveImagePreviewProviderSelection } from '@services/image-generation/providers/registry';
import type {
  ImagePreviewProviderSelection,
  ImagePreviewSpeedMode,
} from '@services/image-generation/providers/types';
import { getStorageService } from '@services/storage/StorageService';
import { getAuthenticatedUserId } from '../auth';

type ImageGenerateServices = Pick<
  PreviewRoutesServices,
  'imageGenerationService' | 'userCreditService' | 'assetService'
>;

const IMAGE_PREVIEW_CREDIT_COST = 1;
const TRIGGER_REGEX = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;

const SPEED_MODE_OPTIONS = new Set<ImagePreviewSpeedMode>([
  'Lightly Juiced',
  'Juiced',
  'Extra Juiced',
  'Real Time',
]);

const hasPromptTriggers = (prompt: string): boolean =>
  Array.from(prompt.matchAll(TRIGGER_REGEX)).length > 0;

export const createImageGenerateHandler = ({
  imageGenerationService,
  userCreditService,
  assetService,
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

    let resolvedPrompt = prompt.trim();
    const shouldResolvePrompt = hasPromptTriggers(resolvedPrompt);
    let resolvedAssetCount = 0;
    let resolvedCharacterCount = 0;

    if (shouldResolvePrompt) {
      if (!assetService) {
        logger.warn('Asset service unavailable for image prompt resolution', {
          userId,
          path: req.path,
        });
      } else {
        try {
          const resolved = await assetService.resolvePrompt(userId, resolvedPrompt);
          const expandedPrompt = resolved.expandedText.trim();
          if (expandedPrompt.length > 0) {
            resolvedPrompt = expandedPrompt;
          }
          resolvedAssetCount = resolved.assets.length;
          resolvedCharacterCount = resolved.characters.length;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            'Image prompt resolution failed',
            error instanceof Error ? error : new Error(errorMessage),
            {
              userId,
              path: req.path,
            }
          );
          return res.status(500).json({
            success: false,
            error: 'Image prompt resolution failed',
            message: errorMessage,
          });
        }
      }
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
      const result = await imageGenerationService.generatePreview(resolvedPrompt, {
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

      let storageResult: {
        storagePath: string;
        viewUrl: string;
        expiresAt: string;
        sizeBytes: number;
      } | null = null;

      try {
        const storage = getStorageService();
        storageResult = await storage.saveFromUrl(userId, result.imageUrl, 'preview-image', {
          model: result.metadata.model,
          promptId: (req.body as { promptId?: string })?.promptId,
          aspectRatio: result.metadata.aspectRatio,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to persist preview image to storage', {
          userId,
          error: errorMessage,
          shouldResolvePrompt,
          resolvedAssetCount,
          resolvedCharacterCount,
        });
      }

      const responseData = storageResult
        ? {
            ...result,
            imageUrl: storageResult.viewUrl,
            viewUrl: storageResult.viewUrl,
            viewUrlExpiresAt: storageResult.expiresAt,
            storagePath: storageResult.storagePath,
            sizeBytes: storageResult.sizeBytes,
          }
        : result;

      return res.json({
        success: true,
        data: responseData,
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
        shouldResolvePrompt,
        resolvedAssetCount,
        resolvedCharacterCount,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Image generation failed',
        message: errorMessage,
      });
    }
  };
