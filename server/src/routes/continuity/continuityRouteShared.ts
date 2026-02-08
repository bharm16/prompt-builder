import type { Request, Response } from 'express';
import { z } from 'zod';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { ContinuitySession, ContinuityShot } from '@services/continuity/types';
import { CreditCostCalculator } from '@services/continuity/CreditCostCalculator';
import { requireUserId, type RequestWithUser } from '@middleware/requireUserId';
import {
  CreateSceneProxySchema,
  CreateShotSchema,
  UpdatePrimaryStyleReferenceSchema,
  UpdateSessionSettingsSchema,
  UpdateShotSchema,
  UpdateStyleReferenceSchema,
} from '@server/schemas/continuity.schemas';

export { requireUserId, type RequestWithUser };
export {
  CreateSceneProxySchema,
  CreateShotSchema,
  UpdatePrimaryStyleReferenceSchema,
  UpdateSessionSettingsSchema,
  UpdateShotSchema,
  UpdateStyleReferenceSchema,
};
export const ContinuitySessionInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    sourceVideoId: z.string().optional().nullable(),
    sourceImageUrl: z.string().optional().nullable(),
    initialPrompt: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

export async function requireSessionForUser(
  service: ContinuitySessionService,
  req: Request,
  res: Response
): Promise<ContinuitySession | null> {
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

const sendValidationError = (res: Response, error: z.ZodError) => {
  res.status(400).json({
    success: false,
    error: 'Invalid request',
    details: error.issues,
  });
};

const buildCameraInput = (
  camera?: z.infer<typeof CreateShotSchema>['camera']
): { camera?: { yaw?: number; pitch?: number; roll?: number; dolly?: number } } => {
  if (!camera) return {};
  return {
    camera: {
      ...(camera.yaw !== undefined ? { yaw: camera.yaw } : {}),
      ...(camera.pitch !== undefined ? { pitch: camera.pitch } : {}),
      ...(camera.roll !== undefined ? { roll: camera.roll } : {}),
      ...(camera.dolly !== undefined ? { dolly: camera.dolly } : {}),
    },
  };
};

const buildCreateShotInput = (input: z.infer<typeof CreateShotSchema>) => ({
  prompt: input.prompt,
  ...(input.continuityMode ? { continuityMode: input.continuityMode } : {}),
  ...(input.generationMode ? { generationMode: input.generationMode } : {}),
  ...(input.styleReferenceId !== undefined ? { styleReferenceId: input.styleReferenceId } : {}),
  ...(input.styleStrength !== undefined ? { styleStrength: input.styleStrength } : {}),
  ...(input.sourceVideoId ? { sourceVideoId: input.sourceVideoId } : {}),
  ...(input.modelId ? { modelId: input.modelId } : {}),
  ...(input.characterAssetId ? { characterAssetId: input.characterAssetId } : {}),
  ...(input.faceStrength !== undefined ? { faceStrength: input.faceStrength } : {}),
  ...buildCameraInput(input.camera),
});

const buildUpdateShotCameraInput = (
  camera?: z.infer<typeof UpdateShotSchema>['camera']
): { camera?: { yaw?: number; pitch?: number; roll?: number; dolly?: number } } => {
  if (!camera) return {};
  return {
    camera: {
      ...(camera.yaw !== undefined ? { yaw: camera.yaw } : {}),
      ...(camera.pitch !== undefined ? { pitch: camera.pitch } : {}),
      ...(camera.roll !== undefined ? { roll: camera.roll } : {}),
      ...(camera.dolly !== undefined ? { dolly: camera.dolly } : {}),
    },
  };
};

export async function handleCreateShot(
  service: ContinuitySessionService,
  req: Request,
  res: Response,
  options: { sessionId: string; status?: number }
): Promise<void> {
  const parsed = CreateShotSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }

  const shot = await service.addShot({
    sessionId: options.sessionId,
    ...buildCreateShotInput(parsed.data),
  });

  res.status(options.status ?? 201).json({ success: true, data: shot });
}

export async function handleUpdateShot(
  service: ContinuitySessionService,
  req: Request,
  res: Response,
  options: { sessionId: string; shotId: string }
): Promise<void> {
  const parsed = UpdateShotSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }

  const updates = {
    ...(parsed.data.prompt !== undefined ? { prompt: parsed.data.prompt } : {}),
    ...(parsed.data.continuityMode !== undefined
      ? { continuityMode: parsed.data.continuityMode }
      : {}),
    ...(parsed.data.generationMode !== undefined ? { generationMode: parsed.data.generationMode } : {}),
    ...(parsed.data.styleReferenceId !== undefined
      ? { styleReferenceId: parsed.data.styleReferenceId }
      : {}),
    ...(parsed.data.styleStrength !== undefined ? { styleStrength: parsed.data.styleStrength } : {}),
    ...(parsed.data.modelId !== undefined ? { modelId: parsed.data.modelId } : {}),
    ...(parsed.data.characterAssetId !== undefined
      ? { characterAssetId: parsed.data.characterAssetId }
      : {}),
    ...(parsed.data.faceStrength !== undefined ? { faceStrength: parsed.data.faceStrength } : {}),
    ...buildUpdateShotCameraInput(parsed.data.camera),
    ...(parsed.data.versions !== undefined
      ? { versions: parsed.data.versions as unknown as ContinuityShot['versions'] }
      : {}),
  };
  const shot = await service.updateShot(options.sessionId, options.shotId, updates);
  res.json({ success: true, data: shot });
}

export async function handleGenerateShot(
  service: ContinuitySessionService,
  session: ContinuitySession,
  req: Request,
  res: Response,
  userCreditService?: UserCreditService | null
): Promise<void> {
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

  const cost = CreditCostCalculator.calculateShotCost(shot, session);

  const reserved = await userCreditService.reserveCredits(session.userId, cost.totalCost);
  if (!reserved) {
    res.status(402).json({
      success: false,
      error: 'Insufficient credits',
      message: `This generation requires up to ${cost.totalCost} credits (including possible retries).`,
    });
    return;
  }

  try {
    const result = await service.generateShot(session.id, shotId);
    const actualRetries = result.retryCount ?? 0;
    const actualCost = cost.perAttemptCost * (actualRetries + 1);
    const refundAmount = cost.totalCost - actualCost;
    if (refundAmount > 0) {
      await userCreditService.refundCredits(session.userId, refundAmount);
    }
    if (result.status === 'failed') {
      await userCreditService.refundCredits(session.userId, actualCost);
    }
    res.json({ success: true, data: result });
  } catch (error) {
    await userCreditService.refundCredits(session.userId, cost.totalCost);
    throw error;
  }
}

export async function handleUpdateStyleReference(
  service: ContinuitySessionService,
  req: Request,
  res: Response,
  options: { sessionId: string; shotId: string }
): Promise<void> {
  const parsed = UpdateStyleReferenceSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }

  const { styleReferenceId } = parsed.data;
  const normalizedStyleReferenceId =
    styleReferenceId === null || styleReferenceId === 'primary'
      ? null
      : styleReferenceId;

  const shot = await service.updateShotStyleReference(
    options.sessionId,
    options.shotId,
    normalizedStyleReferenceId
  );
  res.json({ success: true, data: shot });
}

export async function handleUpdateSessionSettings(
  service: ContinuitySessionService,
  req: Request,
  res: Response,
  options: { sessionId: string }
): Promise<void> {
  const parsed = UpdateSessionSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }

  const updatedSession = await service.updateSessionSettings(options.sessionId, parsed.data.settings);
  res.json({ success: true, data: updatedSession });
}

export async function handleUpdatePrimaryStyleReference(
  service: ContinuitySessionService,
  req: Request,
  res: Response,
  options: { sessionId: string }
): Promise<void> {
  const parsed = UpdatePrimaryStyleReferenceSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }

  const updatedSession = await service.updatePrimaryStyleReference(
    options.sessionId,
    parsed.data.sourceVideoId,
    parsed.data.sourceImageUrl
  );
  res.json({ success: true, data: updatedSession });
}

export async function handleCreateSceneProxy(
  service: ContinuitySessionService,
  req: Request,
  res: Response,
  options: { sessionId: string; status?: number }
): Promise<void> {
  const parsed = CreateSceneProxySchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }

  const updatedSession = await service.createSceneProxy(
    options.sessionId,
    parsed.data.sourceShotId,
    parsed.data.sourceVideoId
  );
  res.status(options.status ?? 201).json({ success: true, data: updatedSession });
}
