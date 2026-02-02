import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import { getVideoCost } from '@config/modelCosts';

const KEYFRAME_CREDIT_COST = 2;
const STYLE_KEYFRAME_CREDIT_COST = 2;

type RequestWithUser = Request & { user?: { uid?: string } };

const CreateSessionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    sourceVideoId: z.string().optional().nullable(),
    sourceImageUrl: z.string().optional().nullable(),
    initialPrompt: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

const CreateShotSchema = z
  .object({
    prompt: z.string().min(1),
    continuityMode: z.enum(['frame-bridge', 'style-match', 'native', 'none']).optional(),
    generationMode: z.enum(['continuity', 'standard']).optional(),
    styleReferenceId: z.string().nullable().optional(),
    styleStrength: z.number().optional(),
    sourceVideoId: z.string().optional(),
    modelId: z.string().optional(),
    characterAssetId: z.string().optional(),
    faceStrength: z.number().optional(),
    camera: z
      .object({
        yaw: z.number().optional(),
        pitch: z.number().optional(),
        roll: z.number().optional(),
        dolly: z.number().optional(),
      })
      .partial()
      .optional(),
  })
  .strip();

const UpdateShotSchema = z
  .object({
    prompt: z.string().optional(),
    continuityMode: z.enum(['frame-bridge', 'style-match', 'native', 'none']).optional(),
    generationMode: z.enum(['continuity', 'standard']).optional(),
    styleReferenceId: z.string().nullable().optional(),
    styleStrength: z.number().optional(),
    modelId: z.string().optional(),
    characterAssetId: z.string().nullable().optional(),
    faceStrength: z.number().optional(),
    versions: z.array(z.record(z.string(), z.unknown())).optional(),
    camera: z
      .object({
        yaw: z.number().optional(),
        pitch: z.number().optional(),
        roll: z.number().optional(),
        dolly: z.number().optional(),
      })
      .partial()
      .optional(),
  })
  .strip();

const UpdateStyleReferenceSchema = z.object({
  styleReferenceId: z.string().nullable(),
});

const UpdateSessionSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});

const UpdatePrimaryStyleReferenceSchema = z
  .object({
    sourceVideoId: z.string().optional(),
    sourceImageUrl: z.string().optional(),
  })
  .strip();

const CreateSceneProxySchema = z
  .object({
    sourceShotId: z.string().optional(),
    sourceVideoId: z.string().optional(),
  })
  .strip();

function requireUserId(req: RequestWithUser, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
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
    res.status(400).json({ success: false, error: 'Invalid sessionId' });
    return null;
  }

  const session = await service.getSession(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return null;
  }
  if (session.userId !== userId) {
    res.status(403).json({ success: false, error: 'Access denied' });
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

      const parsed = CreateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }

      const { name, description, sourceVideoId, sourceImageUrl, initialPrompt, settings } = parsed.data;

      const session = await service.createSession(userId, {
        name,
        ...(typeof description === 'string' ? { description } : {}),
        ...(typeof sourceVideoId === 'string' ? { sourceVideoId } : {}),
        ...(typeof sourceImageUrl === 'string' ? { sourceImageUrl } : {}),
        ...(typeof initialPrompt === 'string' ? { initialPrompt } : {}),
        ...(settings ? { settings } : {}),
      });

      res.status(201).json({ success: true, data: session });
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
      const parsed = CreateShotSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }

      const { prompt, continuityMode, generationMode, styleReferenceId, styleStrength, sourceVideoId, modelId, characterAssetId, faceStrength, camera } =
        parsed.data;

      const shot = await service.addShot({
        sessionId: session.id,
        prompt,
        ...(continuityMode ? { continuityMode } : {}),
        ...(generationMode ? { generationMode } : {}),
        ...(styleReferenceId !== undefined ? { styleReferenceId } : {}),
        ...(styleStrength !== undefined ? { styleStrength } : {}),
        ...(sourceVideoId ? { sourceVideoId } : {}),
        ...(modelId ? { modelId } : {}),
        ...(characterAssetId ? { characterAssetId } : {}),
        ...(faceStrength !== undefined ? { faceStrength } : {}),
        ...(camera ? {
          camera: {
            ...(camera.yaw !== undefined ? { yaw: camera.yaw } : {}),
            ...(camera.pitch !== undefined ? { pitch: camera.pitch } : {}),
            ...(camera.roll !== undefined ? { roll: camera.roll } : {}),
            ...(camera.dolly !== undefined ? { dolly: camera.dolly } : {}),
          },
        } : {}),
      });

      res.status(201).json({ success: true, data: shot });
    })
  );

  router.patch(
    '/sessions/:sessionId/shots/:shotId',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(service, req, res);
      if (!session) return;
      const parsed = UpdateShotSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }

      const shot = await service.updateShot(session.id, req.params.shotId, parsed.data);
      res.json({ success: true, data: shot });
    })
  );

  router.post(
    '/sessions/:sessionId/shots/:shotId/generate',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(service, req, res);
      if (!session) return;
      if (!userCreditService) {
        res.status(503).json({ success: false, error: 'Credit service unavailable' });
        return;
      }
      const shotId = req.params.shotId;
      if (!shotId || Array.isArray(shotId)) {
        res.status(400).json({ success: false, error: 'Invalid shotId' });
        return;
      }

      const shot = session.shots.find((s) => s.id === shotId);
      if (!shot) {
        res.status(404).json({ success: false, error: 'Shot not found' });
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

      const maxRetries = session.defaultSettings.maxRetries ?? 1;
      const perAttemptCost = videoCost + extraCost;
      // Reserve credits for worst-case (all retries). Only first attempt cost is guaranteed;
      // actual usage may be lower. Excess is refunded after generation.
      const totalCost = perAttemptCost * (maxRetries + 1);

      const reserved = await userCreditService.reserveCredits(session.userId, totalCost);
      if (!reserved) {
        res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          message: `This generation requires up to ${totalCost} credits (including possible retries).`,
        });
        return;
      }

      try {
        const result = await service.generateShot(session.id, shotId);
        const actualRetries = result.retryCount ?? 0;
        const actualCost = perAttemptCost * (actualRetries + 1);
        const refundAmount = totalCost - actualCost;
        if (refundAmount > 0) {
          await userCreditService.refundCredits(session.userId, refundAmount);
        }
        if (result.status === 'failed') {
          await userCreditService.refundCredits(session.userId, actualCost);
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
        res.status(400).json({ success: false, error: 'Invalid shotId' });
        return;
      }
      const parsed = UpdateStyleReferenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }
      const { styleReferenceId } = parsed.data;
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
    '/sessions/:sessionId/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const authorizedSession = await requireSessionForUser(service, req, res);
      if (!authorizedSession) return;
      const parsed = UpdateSessionSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }
      const { settings } = parsed.data;
      const updatedSession = await service.updateSessionSettings(
        authorizedSession.id,
        settings
      );
      res.json({ success: true, data: updatedSession });
    })
  );

  router.put(
    '/sessions/:sessionId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const authorizedSession = await requireSessionForUser(service, req, res);
      if (!authorizedSession) return;
      const parsed = UpdatePrimaryStyleReferenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }
      const { sourceVideoId, sourceImageUrl } = parsed.data;
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
      const parsed = CreateSceneProxySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.issues,
        });
        return;
      }
      const { sourceShotId, sourceVideoId } = parsed.data;
      const updatedSession = await service.createSceneProxy(
        authorizedSession.id,
        sourceShotId,
        sourceVideoId
      );
      res.status(201).json({ success: true, data: updatedSession });
    })
  );

  return router;
}

export default createContinuityRoutes;
