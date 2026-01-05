/**
 * Preview Routes
 *
 * Handles image preview generation endpoints
 */

import type { Router, Request, Response } from 'express';
import express from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import { admin } from '@infrastructure/firebaseAdmin';
import { asyncHandler } from '@middleware/asyncHandler';
import { parseVideoPreviewRequest, sendVideoContent } from '@routes/preview/videoRequest';
import { getVideoCost } from '@config/modelCosts';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PreviewRoutesServices } from './types';
import { userCreditService as defaultUserCreditService } from '@services/credits/UserCreditService';

/**
 * Create preview routes
 */
export function createPreviewRoutes(services: PreviewRoutesServices): Router {
  const router = express.Router();

  const {
    imageGenerationService,
    videoGenerationService,
    userCreditService = defaultUserCreditService,
  } = services;

  async function getAuthenticatedUserId(req: Request): Promise<string | null> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length).trim()
      : undefined;

    if (!token) {
      logger.warn('Missing authentication token for video generation', {
        path: req.path,
        ip: req.ip,
      });
      return null;
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;
      (req as Request & { user?: { uid?: string } }).user = { uid };
      return uid;
    } catch (error) {
      logger.warn('Invalid authentication token for video generation', {
        path: req.path,
        ip: req.ip,
        error: (error as Error)?.message,
      });
      return null;
    }
  }

  // POST /api/preview/generate - Generate image preview
  router.post(
    '/generate',
    asyncHandler(async (req: Request, res: Response) => {
      // ... existing code ...
    })
  );

  // POST /api/preview/video/generate - Generate video preview
  router.post(
    '/video/generate',
    asyncHandler(async (req: Request, res: Response) => {
      // Check if service is available
      if (!videoGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
          message: 'No video generation provider is configured',
        });
      }

      const parsed = parseVideoPreviewRequest(req.body);
      if (!parsed.ok) {
        return res.status(parsed.status).json({
          success: false,
          error: parsed.error,
        });
      }

      const { prompt, aspectRatio, model, startImage, inputReference, generationParams } = parsed.payload;
      const userId = await getAuthenticatedUserId(req);

      if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to generate videos.',
        });
      }

      if (!userCreditService) {
        logger.error('User credit service is not available - blocking paid feature access', {
          path: req.path,
        });
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
          message: 'Credit service is not configured',
        });
      }

      const startTime = performance.now();
      const operation = 'generateVideoPreview';
      const requestId = (req as Request & { id?: string }).id;
      const estimatedCost = getVideoCost(model);

      const normalized = normalizeGenerationParams({
        generationParams,
        targetModel: model,
        operation,
        requestId: requestId || 'unknown',
        userId: userId || undefined,
      });

      if (normalized.error) {
        return res.status(normalized.error.status).json({
          success: false,
          error: normalized.error.error,
          message: normalized.error.details,
        });
      }

      const normalizedParams = normalized.normalizedGenerationParams as Record<string, unknown> | null;
      const paramAspectRatio =
        normalizedParams && typeof normalizedParams.aspect_ratio === 'string'
          ? (normalizedParams.aspect_ratio as any)
          : undefined;
      const paramFps =
        normalizedParams && typeof normalizedParams.fps === 'number' ? normalizedParams.fps : undefined;
      const paramDurationS =
        normalizedParams && typeof normalizedParams.duration_s === 'number'
          ? normalizedParams.duration_s
          : undefined;
      const paramResolution =
        normalizedParams && typeof normalizedParams.resolution === 'string'
          ? normalizedParams.resolution
          : undefined;

      const seconds =
        paramDurationS != null && ['4', '8', '12'].includes(String(paramDurationS))
          ? (String(paramDurationS) as any)
          : undefined;

      const size =
        typeof paramResolution === 'string' &&
        (/\d+x\d+/i.test(paramResolution) || /p$/i.test(paramResolution))
          ? paramResolution
          : undefined;

      const numFrames =
        typeof paramDurationS === 'number' && typeof paramFps === 'number'
          ? Math.max(1, Math.min(300, Math.round(paramDurationS * paramFps)))
          : undefined;

      const hasCredits = await userCreditService.reserveCredits(userId, estimatedCost);
      if (!hasCredits) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          message: `This generation requires ${estimatedCost} credits.`,
        });
      }

      logger.debug(`Starting ${operation}`, {
        operation,
        requestId,
        userId,
        promptLength: prompt.length,
        aspectRatio,
        model,
        estimatedCost,
      });

      try {
        const result = await videoGenerationService.generateVideo(prompt, {
          ...(paramAspectRatio || aspectRatio ? { aspectRatio: (paramAspectRatio || aspectRatio) as any } : {}),
          ...(model ? { model: model as any } : {}),
          ...(startImage ? { startImage } : {}),
          ...(inputReference ? { inputReference } : {}),
          ...(typeof paramFps === 'number' ? { fps: paramFps } : {}),
          ...(seconds ? { seconds } : {}),
          ...(size ? { size } : {}),
          ...(typeof numFrames === 'number' ? { numFrames } : {}),
        });

        logger.info(`${operation} completed`, {
          operation,
          requestId,
          userId,
          duration: Math.round(performance.now() - startTime),
          cost: estimatedCost,
        });

        return res.json({
          success: true,
          videoUrl: result,
          creditsDeducted: estimatedCost,
        });
      } catch (error) {
        await userCreditService.refundCredits(userId, estimatedCost);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = (error as { statusCode?: number }).statusCode || 500;

        logger.error(`${operation} failed`, error as Error, {
          operation,
          requestId,
          userId,
          duration: Math.round(performance.now() - startTime),
          refundAmount: estimatedCost,
          statusCode,
        });

        return res.status(statusCode).json({
          success: false,
          error: 'Video generation failed',
          message: errorMessage,
        });
      }
    })
  );

  // GET /api/preview/video/content/:contentId - Serve cached video bytes
  router.get(
    '/video/content/:contentId',
    asyncHandler(async (req: Request, res: Response) => {
      if (!videoGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
        });
      }

      const { contentId } = req.params as { contentId?: string };
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'contentId is required',
        });
      }

      const entry = videoGenerationService.getVideoContent(contentId);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: 'Video content not found or expired',
        });
      }

      return sendVideoContent(res, entry);
    })
  );

  return router;
}
