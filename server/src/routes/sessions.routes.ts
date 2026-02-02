import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@middleware/asyncHandler';
import type { SessionService } from '@services/sessions/SessionService';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import {
  ContinuitySessionInputSchema,
  RequestWithUser,
  handleCreateSceneProxy,
  handleCreateShot,
  handleGenerateShot,
  handleUpdatePrimaryStyleReference,
  handleUpdateSessionSettings,
  handleUpdateShot,
  handleUpdateStyleReference,
  requireSessionForUser,
  requireUserId,
} from './continuity/continuityRouteShared';

const CreateSessionSchema = z.object({
  name: z.string().optional(),
  prompt: z.record(z.string(), z.unknown()).optional(),
}).strip();

const CreateContinuitySessionSchema = ContinuitySessionInputSchema.extend({
  sessionId: z.string().optional(),
}).strip();

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
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleCreateShot(continuityService, req, res, {
        sessionId: session.id,
        status: 200,
      });
    })
  );

  router.patch(
    '/:sessionId/shots/:shotId',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleUpdateShot(continuityService, req, res, {
        sessionId: session.id,
        shotId: req.params.shotId,
      });
    })
  );

  router.post(
    '/:sessionId/shots/:shotId/generate',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleGenerateShot(continuityService, session, req, res, userCreditService);
    })
  );

  router.put(
    '/:sessionId/shots/:shotId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleUpdateStyleReference(continuityService, req, res, {
        sessionId: session.id,
        shotId: req.params.shotId,
      });
    })
  );

  router.put(
    '/:sessionId/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleUpdateSessionSettings(continuityService, req, res, { sessionId: session.id });
    })
  );

  router.put(
    '/:sessionId/style-reference',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleUpdatePrimaryStyleReference(continuityService, req, res, {
        sessionId: session.id,
      });
    })
  );

  router.post(
    '/:sessionId/scene-proxy',
    asyncHandler(async (req: Request, res: Response) => {
      const session = await requireSessionForUser(continuityService, req, res);
      if (!session) return;
      await handleCreateSceneProxy(continuityService, req, res, {
        sessionId: session.id,
        status: 200,
      });
    })
  );

  return router;
}
