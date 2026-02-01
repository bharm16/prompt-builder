/**
 * Motion Routes
 *
 * Lightweight endpoints for the motion controls workflow.
 * Reuses the existing convergence depth estimation service.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { CAMERA_PATHS } from '@services/convergence/constants';
import { createDepthEstimationServiceForUser, getDepthWarmupStatus, getStartupWarmupPromise } from '@services/convergence/depth';
import { getGCSStorageService } from '@services/convergence/storage';
import { safeUrlHost } from '@utils/url';

const log = logger.child({ routes: 'motion' });
const OPERATION = 'estimateDepth';
const DEPTH_ESTIMATION_TIMEOUT_MS = (() => {
  const raw = Number.parseInt(process.env.DEPTH_ESTIMATION_TIMEOUT_MS || '', 10);
  if (Number.isFinite(raw) && raw >= 5_000) {
    return raw;
  }
  return 25_000;
})();

const DEPTH_ESTIMATION_COLD_START_TIMEOUT_MS = (() => {
  const raw = Number.parseInt(process.env.DEPTH_ESTIMATION_COLD_START_TIMEOUT_MS || '', 10);
  if (Number.isFinite(raw) && raw >= 5_000) {
    return raw;
  }
  return Math.max(60_000, DEPTH_ESTIMATION_TIMEOUT_MS);
})();

const DepthEstimationRequestSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
});

interface RequestWithUser extends Request {
  user?: { uid?: string };
  id?: string;
}

interface DepthEstimationSuccessPayload {
  depthMapUrl: string | null;
  cameraPaths: typeof CAMERA_PATHS;
  fallbackMode: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

const buildFallbackResponse = (): ApiResponse<DepthEstimationSuccessPayload> => ({
  success: true,
  data: {
    depthMapUrl: null,
    cameraPaths: CAMERA_PATHS,
    fallbackMode: true,
  },
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Depth estimation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export function createMotionRoutes(): Router {
  const router = express.Router();

  /**
   * POST /api/motion/depth
   *
   * Estimates depth from an uploaded image and returns camera path options.
   */
  router.post(
    '/depth',
    asyncHandler(async (req: RequestWithUser, res: Response) => {
      const requestId = req.id ?? null;
      const depthRequestId = `depth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const startedAt = Date.now();

      const parsed = DepthEstimationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        log.warn('Depth estimation request validation failed', {
          operation: OPERATION,
          requestId,
          depthRequestId,
          issues: parsed.error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        } satisfies ApiResponse<never>);
      }

      const userId = req.user?.uid?.trim();
      if (!userId) {
        log.warn('Depth estimation requested without authenticated user', {
          operation: OPERATION,
          requestId,
          depthRequestId,
        });
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        } satisfies ApiResponse<never>);
      }

      const { imageUrl } = parsed.data;
      const imageUrlHost = safeUrlHost(imageUrl);

      log.info('Depth estimation requested', {
        operation: OPERATION,
        userId,
        requestId,
        depthRequestId,
        imageUrlHost,
      });

      let storageService;
      try {
        storageService = getGCSStorageService();
      } catch (error) {
        log.warn('Storage service unavailable; returning fallback motion options', {
          operation: OPERATION,
          userId,
          requestId,
          depthRequestId,
          imageUrlHost,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.json(buildFallbackResponse());
      }

      const depthService = createDepthEstimationServiceForUser(storageService, userId);
      if (!depthService.isAvailable()) {
        log.warn('Depth estimation service not available; returning fallback mode', {
          operation: OPERATION,
          userId,
          requestId,
          depthRequestId,
          imageUrlHost,
        });
        return res.json(buildFallbackResponse());
      }

      try {
        // If startup warmup is still in-flight, wait for it so the model is warm
        // before making the user's depth estimation call.
        const pendingWarmup = getStartupWarmupPromise();
        if (pendingWarmup) {
          const { warmupInFlight: wif } = getDepthWarmupStatus();
          if (wif) {
            log.debug('Waiting for startup warmup to complete before depth estimation', {
              operation: OPERATION,
              userId,
              requestId,
              depthRequestId,
            });
            await pendingWarmup.catch(() => {
              // Warmup failure is non-fatal; proceed with estimation anyway
            });
          }
        }

        const { warmupInFlight, lastWarmupAt } = getDepthWarmupStatus();
        const coldStart = warmupInFlight || lastWarmupAt === 0;
        const timeoutMs = coldStart
          ? DEPTH_ESTIMATION_COLD_START_TIMEOUT_MS
          : DEPTH_ESTIMATION_TIMEOUT_MS;

        log.debug('Depth estimation starting', {
          operation: OPERATION,
          userId,
          requestId,
          depthRequestId,
          imageUrlHost,
          timeoutMs,
          coldStart,
        });
        const depthMapUrl = await withTimeout(
          depthService.estimateDepth(imageUrl),
          timeoutMs
        );
        const duration = Date.now() - startedAt;
        const depthMapUrlHost = safeUrlHost(depthMapUrl);

        log.info('Depth estimation completed', {
          operation: OPERATION,
          userId,
          requestId,
          depthRequestId,
          duration,
          fallbackMode: false,
          imageUrlHost,
          depthMapUrlHost,
        });
        return res.json({
          success: true,
          data: {
            depthMapUrl,
            cameraPaths: CAMERA_PATHS,
            fallbackMode: false,
          },
        } satisfies ApiResponse<DepthEstimationSuccessPayload>);
      } catch (error) {
        const duration = Date.now() - startedAt;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const timedOut = errorMessage.includes('timed out');
        const { warmupInFlight, lastWarmupAt } = getDepthWarmupStatus();
        const coldStart = warmupInFlight || lastWarmupAt === 0;
        const timeoutMs = coldStart
          ? DEPTH_ESTIMATION_COLD_START_TIMEOUT_MS
          : DEPTH_ESTIMATION_TIMEOUT_MS;
        log.warn('Depth estimation failed; returning fallback mode', {
          operation: OPERATION,
          userId,
          requestId,
          depthRequestId,
          duration,
          imageUrlHost,
          error: errorMessage,
          timedOut,
          timeoutMs,
          coldStart,
        });
        return res.json(buildFallbackResponse());
      }
    })
  );

  return router;
}

export default createMotionRoutes;
