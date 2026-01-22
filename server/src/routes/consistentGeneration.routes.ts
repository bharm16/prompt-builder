import express, { type Request, type Response, type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ConsistentVideoService } from '@services/generation/ConsistentVideoService';
import type { UserCreditService } from '@services/credits/UserCreditService';

const KEYFRAME_COST = 2;
const CONSISTENT_VIDEO_COST = 40;
const FROM_KEYFRAME_COST = 35;

type RequestWithUser = Request & { user?: { uid?: string } };

function requireUserId(req: RequestWithUser, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

export function createConsistentGenerationRoutes(
  consistentVideoService: ConsistentVideoService,
  userCreditService?: UserCreditService | null
): Router {
  const router = express.Router();

  router.post(
    '/keyframe',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      if (!userCreditService) {
        res.status(503).json({ error: 'Credit service unavailable' });
        return;
      }

      const { characterId, prompt, aspectRatio, count } = req.body || {};
      if (!characterId || !prompt) {
        res.status(400).json({ error: 'characterId and prompt are required' });
        return;
      }

      const reserved = await userCreditService.reserveCredits(userId, KEYFRAME_COST);
      if (!reserved) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: `This generation requires ${KEYFRAME_COST} credits.`,
        });
        return;
      }

      try {
        const normalizedCount =
          typeof count === 'number'
            ? Math.max(1, Math.min(5, Math.round(count)))
            : 1;

        const result = await consistentVideoService.generateKeyframeOnly({
          userId,
          characterId,
          prompt,
          aspectRatio,
          count: normalizedCount,
        });

        res.json(result);
      } catch (error) {
        await userCreditService.refundCredits(userId, KEYFRAME_COST);
        throw error;
      }
    })
  );

  router.post(
    '/video',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      if (!userCreditService) {
        res.status(503).json({ error: 'Credit service unavailable' });
        return;
      }

      const { prompt, videoModel, aspectRatio, duration } = req.body || {};
      if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }

      const reserved = await userCreditService.reserveCredits(userId, CONSISTENT_VIDEO_COST);
      if (!reserved) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: `This generation requires ${CONSISTENT_VIDEO_COST} credits.`,
        });
        return;
      }

      try {
        const result = await consistentVideoService.generateConsistentVideo({
          userId,
          prompt,
          videoModel,
          aspectRatio,
          duration,
        });

        res.json(result);
      } catch (error) {
        await userCreditService.refundCredits(userId, CONSISTENT_VIDEO_COST);
        throw error;
      }
    })
  );

  router.post(
    '/from-keyframe',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      if (!userCreditService) {
        res.status(503).json({ error: 'Credit service unavailable' });
        return;
      }

      const { keyframeUrl, prompt, model, aspectRatio, duration } = req.body || {};
      if (!keyframeUrl || !prompt) {
        res.status(400).json({ error: 'keyframeUrl and prompt are required' });
        return;
      }

      const reserved = await userCreditService.reserveCredits(userId, FROM_KEYFRAME_COST);
      if (!reserved) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: `This generation requires ${FROM_KEYFRAME_COST} credits.`,
        });
        return;
      }

      try {
        const result = await consistentVideoService.generateVideoFromApprovedKeyframe({
          keyframeUrl,
          prompt,
          model,
          aspectRatio,
          duration,
        });

        res.json(result);
      } catch (error) {
        await userCreditService.refundCredits(userId, FROM_KEYFRAME_COST);
        throw error;
      }
    })
  );

  return router;
}

export default createConsistentGenerationRoutes;
