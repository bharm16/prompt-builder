import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@middleware/asyncHandler';
import type { SessionService } from '@services/sessions/SessionService';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import { getVideoCost } from '@config/modelCosts';

type RequestWithUser = Request & { user?: { uid?: string } };

const CreateSessionSchema = z.object({
  name: z.string().optional(),
  prompt: z.record(z.string(), z.unknown()).optional(),
}).strip();

const CreateContinuitySessionSchema = z
  .object({
    sessionId: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    sourceVideoId: z.string().optional().nullable(),
    sourceImageUrl: z.string().optional().nullable(),
    initialPrompt: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

const UpdateSessionSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  prompt: z.record(z.string(), z.unknown()).optional(),
}).strip();

const UpdatePromptSchema = z.object({
  title: z.string().nullable().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  targetModel: z.string().nullable().optional(),
  generationParams: z.record(z.string(), z.unknown()).nullable().optional(),
  keyframes: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  mode: z.string().optional(),
}).strip();

const UpdateHighlightsSchema = z.object({
  highlightCache: z.record(z.string(), z.unknown()).nullable().optional(),
  versionEntry: z.object({ timestamp: z.string().optional() }).optional(),
}).strip();

const UpdateOutputSchema = z.object({
  output: z.string().optional(),
}).strip();

const UpdateVersionsSchema = z.object({
  versions: z.array(z.record(z.string(), z.unknown())).optional(),
}).strip();

const CreateShotSchema = z.object({
  prompt: z.string().min(1),
  continuityMode: z.enum(['frame-bridge', 'style-match', 'native', 'none']).optional(),
  generationMode: z.enum(['continuity', 'standard']).optional(),
  styleReferenceId: z.string().nullable().optional(),
  styleStrength: z.number().optional(),
  sourceVideoId: z.string().optional(),
  modelId: z.string().optional(),
  characterAssetId: z.string().optional(),
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
}).strip();

const UpdateShotSchema = z.object({
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
}).strip();

const UpdateStyleReferenceSchema = z.object({
  styleReferenceId: z.string().nullable(),
}).strip();

const UpdateSessionSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
}).strip();

const UpdatePrimaryStyleReferenceSchema = z.object({
  sourceVideoId: z.string().optional(),
  sourceImageUrl: z.string().optional(),
}).strip();

const CreateSceneProxySchema = z.object({
  sourceShotId: z.string().optional(),
  sourceVideoId: z.string().optional(),
}).strip();

function requireUserId(req: RequestWithUser, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }
  return userId;
}

export function createSessionRoutes(
  sessionService: SessionService,
  continuityService: ContinuitySessionService,
  userCreditService?: UserCreditService | null
): Router {
  const router = express.Router();

  router.post(
    '/continuity',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = CreateContinuitySessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      if (parsed.data.sessionId) {
        const existing = await sessionService.getSession(parsed.data.sessionId);
        if (!existing) {
          res.status(404).json({ success: false, error: 'Session not found' });
          return;
        }
        if (existing.userId !== userId) {
          res.status(403).json({ success: false, error: 'Access denied' });
          return;
        }
      }
      const continuitySession = await continuityService.createSession(userId, parsed.data);
      const session = await sessionService.getSession(continuitySession.id);
      if (!session) {
        res.status(500).json({ success: false, error: 'Session not available after creation' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      const includeContinuity = req.query.includeContinuity !== 'false';
      const includePrompt = req.query.includePrompt !== 'false';
      const sessions = await sessionService.listSessions(userId, {
        limit,
        includeContinuity,
        includePrompt,
      });
      res.json({
        success: true,
        data: sessions.map((session) => sessionService.toDto(session)),
      });
    })
  );

  router.get(
    '/by-prompt/:uuid',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const uuid = req.params.uuid;
      const session = await sessionService.getSessionByPromptUuid(userId, uuid);
      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.get(
    '/:sessionId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const session = await sessionService.getSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = CreateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await sessionService.createPromptSession(userId, parsed.data);
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.patch(
    '/:sessionId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await sessionService.updateSession(req.params.sessionId, parsed.data);
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.delete(
    '/:sessionId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const session = await sessionService.getSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      await sessionService.deleteSession(session.id);
      res.json({ success: true });
    })
  );

  router.patch(
    '/:sessionId/prompt',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdatePromptSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await sessionService.updatePrompt(req.params.sessionId, parsed.data);
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.patch(
    '/:sessionId/highlights',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateHighlightsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await sessionService.updateHighlights(req.params.sessionId, parsed.data);
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.patch(
    '/:sessionId/output',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateOutputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await sessionService.updateOutput(req.params.sessionId, parsed.data);
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  router.patch(
    '/:sessionId/versions',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateVersionsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await sessionService.updateVersions(req.params.sessionId, parsed.data);
      if (session.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      res.json({ success: true, data: sessionService.toDto(session) });
    })
  );

  // Continuity operations (session-scoped)
  router.post(
    '/:sessionId/shots',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = CreateShotSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const shot = await continuityService.addShot({ sessionId: req.params.sessionId, ...parsed.data });
      res.json({ success: true, data: shot });
    })
  );

  router.patch(
    '/:sessionId/shots/:shotId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateShotSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const shot = await continuityService.updateShot(req.params.sessionId, req.params.shotId, parsed.data);
      res.json({ success: true, data: shot });
    })
  );

  router.post(
    '/:sessionId/shots/:shotId/generate',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const shot = await continuityService.generateShot(req.params.sessionId, req.params.shotId);

      if (userCreditService) {
        const cost = getVideoCost(shot.modelId, 'render');
        await userCreditService.chargeCredits(userId, cost, {
          type: 'continuity-video',
          sessionId: req.params.sessionId,
          shotId: req.params.shotId,
          modelId: shot.modelId,
        });
      }

      res.json({ success: true, data: shot });
    })
  );

  router.put(
    '/:sessionId/shots/:shotId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateStyleReferenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const shot = await continuityService.updateShotStyleReference(
        req.params.sessionId,
        req.params.shotId,
        parsed.data.styleReferenceId
      );
      res.json({ success: true, data: shot });
    })
  );

  router.put(
    '/:sessionId/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdateSessionSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await continuityService.updateSessionSettings(req.params.sessionId, parsed.data.settings);
      res.json({ success: true, data: session });
    })
  );

  router.put(
    '/:sessionId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = UpdatePrimaryStyleReferenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await continuityService.updatePrimaryStyleReference(
        req.params.sessionId,
        parsed.data.sourceVideoId,
        parsed.data.sourceImageUrl
      );
      res.json({ success: true, data: session });
    })
  );

  router.post(
    '/:sessionId/scene-proxy',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;
      const parsed = CreateSceneProxySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
        return;
      }
      const session = await continuityService.createSceneProxy(
        req.params.sessionId,
        parsed.data.sourceShotId,
        parsed.data.sourceVideoId
      );
      res.json({ success: true, data: session });
    })
  );

  return router;
}
