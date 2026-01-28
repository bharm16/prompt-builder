import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import type { ResolvedPrompt } from '@shared/types/asset';
import { STORYBOARD_FRAME_COUNT } from '@services/image-generation/storyboard/constants';
import { parseImageStoryboardGenerateRequest } from '../imageStoryboardRequest';
import { getAuthenticatedUserId } from '../auth';

type ImageStoryboardGenerateServices = Pick<
  PreviewRoutesServices,
  'storyboardPreviewService' | 'userCreditService' | 'assetService'
>;

const IMAGE_PREVIEW_CREDIT_COST = 1;

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (!('statusCode' in value)) {
    return false;
  }
  const statusCode = (value as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' && Number.isFinite(statusCode);
};

const extractHost = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

const selectCharacterReferenceImage = (
  resolved: ResolvedPrompt | null
): string | undefined => {
  if (!resolved) {
    return undefined;
  }
  const candidates = resolved.referenceImages
    .filter((image) => image.assetType === 'character')
    .map((image) => image.imageUrl.trim())
    .filter((imageUrl) => imageUrl.length > 0);
  if (candidates.length !== 1) {
    return undefined;
  }
  return candidates[0];
};

export const createImageStoryboardGenerateHandler = ({
  storyboardPreviewService,
  userCreditService,
  assetService,
}: ImageStoryboardGenerateServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!storyboardPreviewService) {
      logger.warn('Storyboard preview service unavailable for request', {
        path: req.path,
      });
      return res.status(503).json({
        success: false,
        error: 'Storyboard preview service is not available',
        message: 'Storyboard generation requires an LLM planner and image providers',
      });
    }

    const parsedRequest = parseImageStoryboardGenerateRequest(req.body);
    if (!parsedRequest.ok) {
      logger.warn('Storyboard preview request validation failed', {
        path: req.path,
        error: parsedRequest.error,
      });
      return res.status(400).json({
        success: false,
        error: parsedRequest.error,
      });
    }

    const { prompt, aspectRatio, seedImageUrl, speedMode, seed } = parsedRequest.data;

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to generate storyboard previews.',
      });
    }

    if (!userCreditService) {
      logger.error('User credit service is not available - blocking preview access', undefined, {
        path: req.path,
      });
      return res.status(503).json({
        success: false,
        error: 'Storyboard generation service is not available',
        message: 'Credit service is not configured',
      });
    }

    let resolvedPrompt = prompt;
    let resolvedAssetCount = 0;
    let resolvedCharacterCount = 0;
    let referenceImageUrl: string | undefined;

    if (assetService) {
      try {
        const resolved = await assetService.resolvePrompt(userId, prompt);
        resolvedPrompt = resolved.expandedText;
        resolvedAssetCount = resolved.assets.length;
        resolvedCharacterCount = resolved.characters.length;
        if (!seedImageUrl) {
          referenceImageUrl = selectCharacterReferenceImage(resolved);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          'Storyboard prompt resolution failed',
          error instanceof Error ? error : new Error(errorMessage),
          {
            userId,
            path: req.path,
          }
        );
        return res.status(500).json({
          success: false,
          error: 'Storyboard prompt resolution failed',
          message: errorMessage,
        });
      }
    } else {
      logger.warn('Asset service unavailable for storyboard prompt resolution', {
        userId,
        path: req.path,
      });
    }

    const storyboardFrames = seedImageUrl
      ? Math.max(0, STORYBOARD_FRAME_COUNT - 1)
      : STORYBOARD_FRAME_COUNT;
    const previewCost = storyboardFrames * IMAGE_PREVIEW_CREDIT_COST;

    logger.info('Storyboard preview generation requested', {
      userId,
      promptLength: prompt.length,
      resolvedPromptLength: resolvedPrompt.length,
      aspectRatio,
      speedMode,
      seedProvided: seed !== undefined,
      hasSeedImage: Boolean(seedImageUrl),
      usedReferenceImage: Boolean(referenceImageUrl),
      previewCost,
      storyboardFrames,
      resolvedAssetCount,
      resolvedCharacterCount,
    });

    const hasCredits = await userCreditService.reserveCredits(userId, previewCost);
    if (!hasCredits) {
      logger.warn('Insufficient credits for storyboard preview', {
        userId,
        previewCost,
        storyboardFrames,
      });
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `This storyboard requires ${previewCost} credit${previewCost === 1 ? '' : 's'}.`,
      });
    }

    try {
      const result = await storyboardPreviewService.generateStoryboard({
        prompt: resolvedPrompt,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(seedImageUrl ? { seedImageUrl } : {}),
        ...(referenceImageUrl ? { referenceImageUrl } : {}),
        ...(speedMode ? { speedMode } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(userId ? { userId } : {}),
      });

      const imageHosts = Array.from(
        new Set(
          result.imageUrls
            .map((url) => extractHost(url))
            .filter((host): host is string => Boolean(host))
        )
      );

      logger.info('Storyboard preview generation succeeded', {
        userId,
        imageCount: result.imageUrls.length,
        baseImageHost: extractHost(result.baseImageUrl),
        imageHosts,
      });

      return res.json({
        success: true,
        data: {
          imageUrls: result.imageUrls,
          storagePaths: result.storagePaths,
          deltas: result.deltas,
          baseImageUrl: result.baseImageUrl,
        },
      });
    } catch (error: unknown) {
      await userCreditService.refundCredits(userId, previewCost);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = hasStatusCode(error) ? error.statusCode : 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);

      logger.error('Storyboard preview generation failed', errorInstance, {
        statusCode,
        userId,
        aspectRatio,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Storyboard generation failed',
        message: errorMessage,
      });
    }
  };
