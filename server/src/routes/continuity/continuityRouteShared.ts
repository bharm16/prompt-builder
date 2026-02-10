import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendApiError } from '@middleware/apiErrorResponse';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { ContinuitySession, ContinuityShot } from '@services/continuity/types';
import { CreditCostCalculator } from '@services/continuity/CreditCostCalculator';
import { GENERATION_ERROR_CODES } from '@routes/generationErrorCodes';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';
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
  res: Response,
  options?: { canonicalErrors?: boolean }
): Promise<ContinuitySession | null> {
  const userId = options?.canonicalErrors
    ? (req as RequestWithUser).user?.uid ?? null
    : requireUserId(req as RequestWithUser, res);
  if (!userId && options?.canonicalErrors) {
    sendApiError(res, req, 401, {
      error: 'Authentication required',
      code: GENERATION_ERROR_CODES.AUTH_REQUIRED,
    });
  }
  if (!userId) return null;

  const sessionId = req.params.sessionId;
  if (!sessionId || Array.isArray(sessionId)) {
    if (options?.canonicalErrors) {
      sendApiError(res, req, 400, {
        error: 'Invalid sessionId',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid sessionId' });
    }
    return null;
  }

  const session = await service.getSession(sessionId);
  if (!session) {
    if (options?.canonicalErrors) {
      sendApiError(res, req, 404, {
        error: 'Session not found',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    } else {
      res.status(404).json({ success: false, error: 'Session not found' });
    }
    return null;
  }
  if (session.userId !== userId) {
    if (options?.canonicalErrors) {
      sendApiError(res, req, 403, {
        error: 'Access denied',
        code: GENERATION_ERROR_CODES.AUTH_REQUIRED,
      });
    } else {
      res.status(403).json({ success: false, error: 'Access denied' });
    }
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
    sendApiError(res, req, 503, {
      error: 'Credit service unavailable',
      code: GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE,
    });
    return;
  }

  const shotId = req.params.shotId;
  if (!shotId || Array.isArray(shotId)) {
    sendApiError(res, req, 400, {
      error: 'Invalid shotId',
      code: GENERATION_ERROR_CODES.INVALID_REQUEST,
    });
    return;
  }

  const shot = session.shots.find((s) => s.id === shotId);
  if (!shot) {
    sendApiError(res, req, 404, {
      error: 'Shot not found',
      code: GENERATION_ERROR_CODES.INVALID_REQUEST,
    });
    return;
  }

  const cost = CreditCostCalculator.calculateShotCost(shot, session);
  const requestId = (req as Request & { id?: string }).id;
  const operationToken =
    requestId ??
    buildRefundKey([
      'continuity-shot',
      session.id,
      shotId,
      session.userId,
      Date.now(),
      Math.random(),
    ]);
  const unusedRetriesRefundKey = buildRefundKey([
    'continuity-shot',
    operationToken,
    'unusedRetries',
  ]);
  const failedActualCostRefundKey = buildRefundKey([
    'continuity-shot',
    operationToken,
    'failedActualCost',
  ]);
  const catchAllRefundKey = buildRefundKey(['continuity-shot', operationToken, 'catchAll']);

  const reserved = await userCreditService.reserveCredits(session.userId, cost.totalCost);
  if (!reserved) {
    sendApiError(res, req, 402, {
      error: 'Insufficient credits',
      code: GENERATION_ERROR_CODES.INSUFFICIENT_CREDITS,
      details: `This generation requires up to ${cost.totalCost} credits (including possible retries).`,
    });
    return;
  }

  try {
    const result = await service.generateShot(session.id, shotId);
    const actualRetries = result.retryCount ?? 0;
    const actualCost = cost.perAttemptCost * (actualRetries + 1);
    const refundAmount = cost.totalCost - actualCost;
    if (refundAmount > 0) {
      await refundWithGuard({
        userCreditService,
        userId: session.userId,
        amount: refundAmount,
        refundKey: unusedRetriesRefundKey,
        reason: 'continuity shot unused retry budget',
        metadata: {
          requestId,
          sessionId: session.id,
          shotId,
        },
      });
    }
    if (result.status === 'failed') {
      await refundWithGuard({
        userCreditService,
        userId: session.userId,
        amount: actualCost,
        refundKey: failedActualCostRefundKey,
        reason: 'continuity shot failed actual cost',
        metadata: {
          requestId,
          sessionId: session.id,
          shotId,
        },
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    await refundWithGuard({
      userCreditService,
      userId: session.userId,
      amount: cost.totalCost,
      refundKey: catchAllRefundKey,
      reason: 'continuity shot generation exception',
      metadata: {
        requestId,
        sessionId: session.id,
        shotId,
      },
    });

    const statusCode =
      typeof (error as { statusCode?: unknown })?.statusCode === 'number'
        ? ((error as { statusCode?: number }).statusCode as number)
        : 500;

    sendApiError(res, req, statusCode, {
      error: 'Shot generation failed',
      code:
        statusCode === 503
          ? GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE
          : GENERATION_ERROR_CODES.GENERATION_FAILED,
      details: error instanceof Error ? error.message : String(error),
    });
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
