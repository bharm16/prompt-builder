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
import { extractFirebaseToken } from '@utils/auth';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import type { VideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { getCapabilitiesRegistry } from '@services/capabilities';

const LOCAL_CONTENT_PREFIX = '/api/preview/video/content';

let capabilityModelIdsCache: string[] | null = null;

const getCapabilityModelIds = (): string[] => {
  if (capabilityModelIdsCache) {
    return capabilityModelIdsCache;
  }

  const ids = new Set<string>();
  for (const [provider, models] of Object.entries(getCapabilitiesRegistry())) {
    if (provider === 'generic') continue;
    for (const modelId of Object.keys(models)) {
      ids.add(modelId);
    }
  }
  capabilityModelIdsCache = Array.from(ids);
  return capabilityModelIdsCache;
};

const emptyAvailability = () => ({
  providers: {
    replicate: false,
    openai: false,
    luma: false,
    kling: false,
    gemini: false,
  },
  models: [],
  availableModels: [],
});

function extractVideoContentToken(req: Request): string | null {
  const token = req.query?.token;
  if (typeof token === 'string' && token.trim().length > 0) {
    return token.trim();
  }
  return null;
}

function isLocalContentUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    try {
      const parsed = new URL(rawUrl);
      return parsed.pathname.startsWith(LOCAL_CONTENT_PREFIX);
    } catch {
      return false;
    }
  }

  return rawUrl.startsWith(LOCAL_CONTENT_PREFIX);
}

function buildVideoContentUrl(
  accessService: VideoContentAccessService | null | undefined,
  rawUrl: string | null | undefined,
  assetId: string,
  userId?: string | null
): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  if (!accessService) {
    return isLocalContentUrl(rawUrl) ? undefined : rawUrl;
  }

  return accessService.buildAccessUrl(rawUrl, assetId, userId || undefined);
}

/**
 * Create preview routes
 */
export function createPreviewRoutes(services: PreviewRoutesServices): Router {
  const router = express.Router();

  const {
    imageGenerationService,
    videoGenerationService,
    videoJobStore,
    videoContentAccessService,
    userCreditService = defaultUserCreditService,
  } = services;

  async function getAuthenticatedUserId(req: Request): Promise<string | null> {
    const apiKey = (req as Request & { apiKey?: string }).apiKey;
    if (apiKey && process.env.NODE_ENV !== 'production') {
      return `dev-api-key:${apiKey}`;
    }

    const token = extractFirebaseToken(req);

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
      if (!imageGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Image generation service is not available',
          message: 'REPLICATE_API_TOKEN is not configured',
        });
      }

      const { prompt, aspectRatio } = (req.body || {}) as {
        prompt?: unknown;
        aspectRatio?: unknown;
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

      const userId = await getAuthenticatedUserId(req);
      try {
        const result = await imageGenerationService.generatePreview(prompt, {
          ...(aspectRatio ? { aspectRatio } : {}),
          ...(userId ? { userId } : {}),
        });

        return res.json({
          success: true,
          data: result,
        });
      } catch (error) {
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
    })
  );

  // GET /api/preview/video/availability - Available video providers/models
  router.get(
    '/video/availability',
    asyncHandler(async (_req: Request, res: Response) => {
      if (!videoGenerationService) {
        return res.json(emptyAvailability());
      }

      const report = videoGenerationService.getAvailabilityReport(getCapabilityModelIds());
      return res.json(report);
    })
  );

  // POST /api/preview/video/generate - Generate video preview
  router.post(
    '/video/generate',
    asyncHandler(async (req: Request, res: Response) => {
      // Check if service is available
      if (!videoGenerationService || !videoJobStore) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
          message: 'Video generation queue is not configured',
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
        logger.error('User credit service is not available - blocking paid feature access', undefined, {
          path: req.path,
        });
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
          message: 'Credit service is not configured',
        });
      }

      const availability = videoGenerationService.getModelAvailability(model);
      if (!availability.available) {
        const report = videoGenerationService.getAvailabilityReport(getCapabilityModelIds());
        const statusCode = availability.statusCode || 424;
        return res.status(statusCode).json({
          success: false,
          error: 'Video model not available',
          message: availability.message || 'Requested video model is not available',
          model: model || 'auto',
          reason: availability.reason,
          requiredKey: availability.requiredKey,
          resolvedModelId: availability.resolvedModelId,
          availableModels: report.availableModels,
        });
      }

      const operation = 'generateVideoPreview';
      const requestId = (req as Request & { id?: string }).id;
      const costModel = availability.resolvedModelId || model;
      const estimatedCost = getVideoCost(costModel);

      const normalized = normalizeGenerationParams({
        generationParams,
        operation,
        requestId: requestId || 'unknown',
        userId,
        ...(model ? { targetModel: model } : {}),
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
          ? (normalizedParams.aspect_ratio as VideoGenerationOptions['aspectRatio'])
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
          ? (String(paramDurationS) as VideoGenerationOptions['seconds'])
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

      const options: VideoGenerationOptions = {};
      const resolvedAspectRatio = paramAspectRatio || aspectRatio;
      if (resolvedAspectRatio) {
        options.aspectRatio = resolvedAspectRatio as NonNullable<VideoGenerationOptions['aspectRatio']>;
      }
      if (model) {
        options.model = model as NonNullable<VideoGenerationOptions['model']>;
      }
      if (startImage) {
        options.startImage = startImage;
      }
      if (inputReference) {
        options.inputReference = inputReference;
      }
      if (typeof paramFps === 'number') {
        options.fps = paramFps;
      }
      if (seconds) {
        options.seconds = seconds;
      }
      if (size) {
        options.size = size;
      }
      if (typeof numFrames === 'number') {
        options.numFrames = numFrames;
      }

      logger.debug(`Queueing ${operation}`, {
        operation,
        requestId,
        userId,
        promptLength: prompt.length,
        aspectRatio,
        model,
        estimatedCost,
      });

      try {
        const job = await videoJobStore.createJob({
          userId,
          request: {
            prompt,
            options,
          },
          creditsReserved: estimatedCost,
        });

        logger.info(`${operation} queued`, {
          operation,
          requestId,
          userId,
          jobId: job.id,
          cost: estimatedCost,
        });

        return res.status(202).json({
          success: true,
          jobId: job.id,
          status: job.status,
          creditsReserved: estimatedCost,
          creditsDeducted: estimatedCost,
        });
      } catch (error) {
        await userCreditService.refundCredits(userId, estimatedCost);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = (error as { statusCode?: number }).statusCode || 500;
        const errorInstance = error instanceof Error ? error : new Error(errorMessage);

        logger.error(`${operation} failed`, errorInstance, {
          operation,
          requestId,
          userId,
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

  // GET /api/preview/video/jobs/:jobId - Check job status
  router.get(
    '/video/jobs/:jobId',
    asyncHandler(async (req: Request, res: Response) => {
      if (!videoGenerationService || !videoJobStore) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
        });
      }

      const userId = await getAuthenticatedUserId(req);
      if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to view video jobs.',
        });
      }

      const { jobId } = req.params as { jobId?: string };
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'jobId is required',
        });
      }

      const job = await videoJobStore.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Video job not found',
        });
      }

      if (job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'This job does not belong to the authenticated user.',
        });
      }

      const response: Record<string, unknown> = {
        success: true,
        jobId: job.id,
        status: job.status,
        creditsReserved: job.creditsReserved,
        creditsDeducted: job.creditsReserved,
      };

      if (job.status === 'completed' && job.result) {
        const freshUrl = await videoGenerationService.getVideoUrl(job.result.assetId);
        const rawUrl = freshUrl || job.result.videoUrl;
        const secureUrl = buildVideoContentUrl(
          videoContentAccessService,
          rawUrl,
          job.result.assetId,
          userId
        );
        if (secureUrl) {
          response.videoUrl = secureUrl;
        }
        response.assetId = job.result.assetId;
        response.contentType = job.result.contentType;
      }

      if (job.status === 'failed') {
        response.error = job.error?.message || 'Video generation failed';
      }

      return res.json(response);
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

      const token = extractVideoContentToken(req);
      if (token && !videoContentAccessService) {
        return res.status(503).json({
          success: false,
          error: 'Video access tokens are not configured',
        });
      }

      const tokenPayload = token && videoContentAccessService
        ? videoContentAccessService.verifyToken(token, contentId)
        : null;

      if (!tokenPayload) {
        if (!videoJobStore) {
          return res.status(503).json({
            success: false,
            error: 'Video job store is not available',
          });
        }

        const userId = await getAuthenticatedUserId(req);
        if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'You must be logged in to access this video content.',
          });
        }

        const job = await videoJobStore.findJobByAssetId(contentId);
        if (!job) {
          return res.status(404).json({
            success: false,
            error: 'Video content not found or expired',
          });
        }

        if (job.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'This video does not belong to the authenticated user.',
          });
        }
      }

      const entry = await videoGenerationService.getVideoContent(contentId);
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

export function createPublicPreviewRoutes(
  services: Pick<PreviewRoutesServices, 'videoGenerationService' | 'videoContentAccessService'>
): Router {
  const router = express.Router();

  router.get(
    '/video/content/:contentId',
    asyncHandler(async (req: Request, res: Response) => {
      const { videoGenerationService, videoContentAccessService } = services;

      if (!videoGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
        });
      }

      if (!videoContentAccessService) {
        return res.status(503).json({
          success: false,
          error: 'Video access tokens are not configured',
        });
      }

      const { contentId } = req.params as { contentId?: string };
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'contentId is required',
        });
      }

      const token = extractVideoContentToken(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Access token required',
        });
      }

      const tokenPayload = videoContentAccessService.verifyToken(token, contentId);
      if (!tokenPayload) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired access token',
        });
      }

      const entry = await videoGenerationService.getVideoContent(contentId);
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
