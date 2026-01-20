import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { STORYBOARD_FRAME_COUNT } from '@services/image-generation/storyboard/StoryboardPreviewService';
import type { ImagePreviewSpeedMode } from '@services/image-generation/providers/types';
import { getAuthenticatedUserId } from '../auth';

type ImageStoryboardGenerateServices = Pick<
  PreviewRoutesServices,
  'storyboardPreviewService' | 'userCreditService'
>;

const SPEED_MODE_OPTIONS = new Set<ImagePreviewSpeedMode>([
  'Lightly Juiced',
  'Juiced',
  'Extra Juiced',
  'Real Time',
]);
const IMAGE_PREVIEW_CREDIT_COST = 1;

export const createImageStoryboardGenerateHandler = ({
  storyboardPreviewService,
  userCreditService,
}: ImageStoryboardGenerateServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!storyboardPreviewService) {
      return res.status(503).json({
        success: false,
        error: 'Storyboard preview service is not available',
        message: 'Storyboard generation requires an LLM planner and image providers',
      });
    }

    const { prompt, aspectRatio, seedImageUrl, speedMode, seed } = (req.body || {}) as {
      prompt?: unknown;
      aspectRatio?: unknown;
      seedImageUrl?: unknown;
      speedMode?: unknown;
      seed?: unknown;
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

    let normalizedSeedImageUrl: string | undefined;
    if (seedImageUrl !== undefined) {
      if (typeof seedImageUrl !== 'string' || seedImageUrl.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'seedImageUrl must be a non-empty string',
        });
      }
      normalizedSeedImageUrl = seedImageUrl.trim();
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

    const storyboardFrames = normalizedSeedImageUrl
      ? Math.max(0, STORYBOARD_FRAME_COUNT - 1)
      : STORYBOARD_FRAME_COUNT;
    const previewCost = storyboardFrames * IMAGE_PREVIEW_CREDIT_COST;
    const hasCredits = await userCreditService.reserveCredits(userId, previewCost);
    if (!hasCredits) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `This storyboard requires ${previewCost} credit${previewCost === 1 ? '' : 's'}.`,
      });
    }

    try {
      const result = await storyboardPreviewService.generateStoryboard({
        prompt: prompt.trim(),
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(normalizedSeedImageUrl ? { seedImageUrl: normalizedSeedImageUrl } : {}),
        ...(normalizedSpeedMode ? { speedMode: normalizedSpeedMode } : {}),
        ...(normalizedSeed !== undefined ? { seed: normalizedSeed } : {}),
        ...(userId ? { userId } : {}),
      });

      return res.json({
        success: true,
        data: {
          imageUrls: result.imageUrls,
          deltas: result.deltas,
          baseImageUrl: result.baseImageUrl,
        },
      });
    } catch (error: unknown) {
      await userCreditService.refundCredits(userId, previewCost);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
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
