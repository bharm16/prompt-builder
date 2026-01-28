import express, { type Request, type Response, type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import { getVideoCost } from '@config/modelCosts';

const KEYFRAME_CREDIT_COST = 2;
const STYLE_KEYFRAME_CREDIT_COST = 2;

type RequestWithUser = Request & { user?: { uid?: string } };

function requireUserId(req: RequestWithUser, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

async function requireSessionForUser(
  service: ContinuitySessionService,
  req: Request,
  res: Response
) {
  const userId = requireUserId(req as RequestWithUser, res);
  if (!userId) return null;

  const sessionId = req.params.sessionId;
  if (!sessionId || Array.isArray(sessionId)) {
    res.status(400).json({ error: 'Invalid sessionId' });
    return null;
  }

  const session = await service.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  if (session.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return session;
}

export function createContinuityRoutes(
  service: ContinuitySessionService,
  userCreditService?: UserCreditService | null
): Router {
  const router = express.Router();

  router.post(
    '/sessions',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const { name, description, sourceVideoId, sourceImageUrl, initialPrompt, settings } = req.body || {};
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const session = await service.createSession(userId, {
        name,
        description,
        sourceVideoId,
        sourceImageUrl,
        initialPrompt,
        settings,
      });

      res.json({ success: true, data: session });
    })
  );

  router.get(
    '/sessions',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const sessions = await service.getUserSessions(userId);
      res.json({ success: true, data: sessions });
    })
  );

  router.get(
    '/sessions/:sessionId',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(service, req, res);
      if (!session) return;
      res.json({ success: true, data: session });
    })
  );

  router.post(
    '/sessions/:sessionId/shots',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(service, req, res);
      if (!session) return;
      const { prompt, continuityMode, generationMode, styleReferenceId, styleStrength, modelId, characterAssetId, camera } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }

      const shot = await service.addShot({
        sessionId: session.id,
        prompt,
        continuityMode,
        generationMode,
        styleReferenceId,
        styleStrength,
        modelId,
        characterAssetId,
        camera,
      });

      res.json({ success: true, data: shot });
    })
  );

  router.post(
    '/sessions/:sessionId/shots/:shotId/generate',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(service, req, res);
      if (!session) return;
      if (!userCreditService) {
        res.status(503).json({ error: 'Credit service unavailable' });
        return;
      }
      const shotId = req.params.shotId;
      if (!shotId || Array.isArray(shotId)) {
        res.status(400).json({ error: 'Invalid shotId' });
        return;
      }

      const shot = session.shots.find((s) => s.id === shotId);
      if (!shot) {
        res.status(404).json({ error: 'Shot not found' });
        return;
      }

      const generationMode = shot.generationMode || session.defaultSettings.generationMode;
      const continuityMode = generationMode === 'continuity' ? shot.continuityMode : 'none';

      const videoCost = getVideoCost(shot.modelId);
      let extraCost = 0;
      if (generationMode === 'continuity' && continuityMode === 'style-match') {
        if (shot.characterAssetId || session.defaultSettings.useCharacterConsistency) {
          extraCost += KEYFRAME_CREDIT_COST;
        } else {
          extraCost += STYLE_KEYFRAME_CREDIT_COST;
        }
      } else if (generationMode === 'standard' && shot.characterAssetId) {
        extraCost += KEYFRAME_CREDIT_COST;
      }

      const totalCost = videoCost + extraCost;
      const reserved = await userCreditService.reserveCredits(session.userId, totalCost);
      if (!reserved) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: `This generation requires ${totalCost} credits.`,
        });
        return;
      }

      try {
        const result = await service.generateShot(session.id, shotId);
        if (result.status === 'failed') {
          await userCreditService.refundCredits(session.userId, totalCost);
        }
        res.json({ success: true, data: result });
      } catch (error) {
        await userCreditService.refundCredits(session.userId, totalCost);
        throw error;
      }
    })
  );

  router.put(
    '/sessions/:sessionId/shots/:shotId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(service, req, res);
      if (!session) return;
      const shotId = req.params.shotId;
      if (!shotId || Array.isArray(shotId)) {
        res.status(400).json({ error: 'Invalid shotId' });
        return;
      }
      const { styleReferenceId } = req.body || {};
      if (styleReferenceId === undefined) {
        res.status(400).json({ error: 'styleReferenceId is required' });
        return;
      }
      const normalizedStyleReferenceId =
        styleReferenceId === null || styleReferenceId === 'primary'
          ? null
          : styleReferenceId;
      const shot = await service.updateShotStyleReference(
        session.id,
        shotId,
        normalizedStyleReferenceId
      );
      res.json({ success: true, data: shot });
    })
  );

  router.put(
    '/sessions/:sessionId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const authorizedSession = await requireSessionForUser(service, req, res);
      if (!authorizedSession) return;
      const { sourceVideoId, sourceImageUrl } = req.body || {};
      const updatedSession = await service.updatePrimaryStyleReference(
        authorizedSession.id,
        sourceVideoId,
        sourceImageUrl
      );
      res.json({ success: true, data: updatedSession });
    })
  );

  router.post(
    '/sessions/:sessionId/scene-proxy',
    asyncHandler(async (req: Request, res: Response) => {
      const authorizedSession = await requireSessionForUser(service, req, res);
      if (!authorizedSession) return;
      const { sourceShotId, sourceVideoId } = req.body || {};
      const updatedSession = await service.createSceneProxy(
        authorizedSession.id,
        sourceShotId,
        sourceVideoId
      );
      res.json({ success: true, data: updatedSession });
    })
  );

  return router;
}

export default createContinuityRoutes;
