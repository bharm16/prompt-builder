import express, { type Request, type Response, type Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ModelIntelligenceService } from '@services/model-intelligence/ModelIntelligenceService';
import {
  ModelRecommendationRequestSchema,
} from '@services/model-intelligence/schemas/requests';

interface RequestWithUser extends Request {
  user?: { uid?: string };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

const log = logger.child({ routes: 'model-intelligence' });

export function createModelIntelligenceRoutes(
  modelIntelligenceService: ModelIntelligenceService | null
): Router {
  const router = express.Router();

  router.post(
    '/model-intelligence/recommend',
    asyncHandler(async (req: RequestWithUser, res: Response): Promise<Response> => {
      if (!modelIntelligenceService) {
        return res.status(503).json({
          success: false,
          error: 'Model intelligence service unavailable',
        } satisfies ApiResponse<never>);
      }

      const parsed = ModelRecommendationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        log.warn('Model recommendation request validation failed', {
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

      const { prompt, mode, spans, durationSeconds } = parsed.data;
      const userId = req.user?.uid ?? null;

      try {
        const recommendation = await modelIntelligenceService.getRecommendation(prompt, {
          mode,
          spans,
          durationSeconds,
          userId,
        });

        return res.json({
          success: true,
          data: recommendation,
        } satisfies ApiResponse<typeof recommendation>);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Model recommendation failed', error instanceof Error ? error : new Error(errorMessage), {
          error: errorMessage,
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to generate recommendation',
          details: errorMessage,
        } satisfies ApiResponse<never>);
      }
    })
  );

  return router;
}

export default createModelIntelligenceRoutes;
