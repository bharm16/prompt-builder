import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { assertUrlSafe } from '@server/shared/urlValidation';
import { sendApiError } from '@middleware/apiErrorResponse';
import { GENERATION_ERROR_CODES } from '@routes/generationErrorCodes';
import type { ApiErrorCode } from '@server/types/apiError';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';

const FACE_SWAP_CREDIT_COST = 2;
const log = logger.child({ route: 'preview.faceSwap' });

type FaceSwapServices = Pick<
  PreviewRoutesServices,
  | 'faceSwapService'
  | 'assetService'
  | 'userCreditService'
  | 'requestIdempotencyService'
>;

export const createFaceSwapPreviewHandler = ({
  faceSwapService,
  assetService,
  userCreditService,
  requestIdempotencyService,
}: FaceSwapServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!faceSwapService || !assetService) {
      return sendApiError(res, req, 503, {
        error: 'Face-swap service is not available',
        code: GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE,
        details: 'Face-swap preprocessing is not configured',
      });
    }

    const { characterAssetId, targetImageUrl, aspectRatio } = (req.body || {}) as {
      characterAssetId?: unknown;
      targetImageUrl?: unknown;
      aspectRatio?: unknown;
    };

    if (!characterAssetId || typeof characterAssetId !== 'string') {
      return sendApiError(res, req, 400, {
        error: 'characterAssetId must be a string',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    }

    if (!targetImageUrl || typeof targetImageUrl !== 'string') {
      return sendApiError(res, req, 400, {
        error: 'targetImageUrl must be a string URL',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    }

    const normalizedCharacterAssetId = characterAssetId.trim();
    const normalizedTargetImageUrl = targetImageUrl.trim();
    if (!normalizedCharacterAssetId) {
      return sendApiError(res, req, 400, {
        error: 'characterAssetId must be a non-empty string',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    }

    if (!normalizedTargetImageUrl) {
      return sendApiError(res, req, 400, {
        error: 'targetImageUrl must be a non-empty string URL',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    }

    try {
      assertUrlSafe(normalizedTargetImageUrl, 'targetImageUrl');
    } catch (error) {
      return sendApiError(res, req, 400, {
        error: 'Invalid targetImageUrl',
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
        details: error instanceof Error ? error.message : 'URL validation failed',
      });
    }

    const userId = (req as Request & { user?: { uid?: string } }).user?.uid ?? null;
    const requestId = (req as Request & { id?: string }).id;
    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return sendApiError(res, req, 401, {
        error: 'Authentication required',
        code: GENERATION_ERROR_CODES.AUTH_REQUIRED,
        details: 'You must be logged in to preview face swaps.',
      });
    }

    const rawIdempotencyKey = req.get('Idempotency-Key');
    const idempotencyKey =
      typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim().length > 0
        ? rawIdempotencyKey.trim()
        : null;
    let idempotencyRecordId: string | null = null;

    const releaseIdempotencyLock = async (reason: string): Promise<void> => {
      if (!idempotencyRecordId || !requestIdempotencyService) {
        return;
      }
      await requestIdempotencyService.markFailed(idempotencyRecordId, reason);
    };

    const respondWithError = async (
      status: number,
      payload: { error: string; code: ApiErrorCode; details?: string }
    ): Promise<Response> => {
      await releaseIdempotencyLock(payload.code || payload.error);
      return sendApiError(res, req, status, payload);
    };

    if (idempotencyKey) {
      if (!requestIdempotencyService) {
        log.warn('Idempotency key supplied but request idempotency service is unavailable', {
          userId,
          requestId,
          path: req.path,
        });
        return sendApiError(res, req, 503, {
          error: 'Face-swap service is not available',
          code: GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE,
          details: 'Idempotency service is not configured',
        });
      }

      const claim = await requestIdempotencyService.claimRequest({
        userId,
        route: '/api/preview/face-swap',
        key: idempotencyKey,
        payload: {
          characterAssetId: normalizedCharacterAssetId,
          targetImageUrl: normalizedTargetImageUrl,
          ...(typeof aspectRatio === 'string' ? { aspectRatio } : {}),
        },
      });

      if (claim.state === 'replay') {
        return res.status(claim.snapshot.statusCode).json(claim.snapshot.body);
      }
      if (claim.state === 'conflict') {
        return sendApiError(res, req, 409, {
          error: 'Idempotency key was already used with a different payload',
          code: GENERATION_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        });
      }
      if (claim.state === 'in_progress') {
        return sendApiError(res, req, 409, {
          error: 'A matching request is already in progress',
          code: GENERATION_ERROR_CODES.REQUEST_IN_PROGRESS,
        });
      }

      idempotencyRecordId = claim.recordId;
    }

    if (!userCreditService) {
      log.error('User credit service is not available - blocking face swap preview', undefined, {
        path: req.path,
      });
      return await respondWithError(503, {
        error: 'Face-swap service is not available',
        code: GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE,
        details: 'Credit service is not configured',
      });
    }

    const refundKey = buildRefundKey([
      'preview-face-swap',
      req.id ?? 'no-request-id',
      userId,
      normalizedCharacterAssetId,
      normalizedTargetImageUrl,
    ]);
    const hasCredits = await userCreditService.reserveCredits(userId, FACE_SWAP_CREDIT_COST);
    if (!hasCredits) {
      return await respondWithError(402, {
        error: 'Insufficient credits',
        code: GENERATION_ERROR_CODES.INSUFFICIENT_CREDITS,
        details: `Face-swap preview requires ${FACE_SWAP_CREDIT_COST} credits.`,
      });
    }

    try {
      const characterData = await assetService.getAssetForGeneration(
        userId,
        normalizedCharacterAssetId
      );

      if (!characterData.primaryImageUrl) {
        await refundWithGuard({
          userCreditService,
          userId,
          amount: FACE_SWAP_CREDIT_COST,
          refundKey,
          reason: 'face swap character missing reference image',
          metadata: {
            characterAssetId: normalizedCharacterAssetId,
          },
        });
        return await respondWithError(400, {
          error: 'Character has no reference image',
          code: GENERATION_ERROR_CODES.INVALID_REQUEST,
          details: 'The character asset must have a reference image for face-swap.',
        });
      }

      log.info('Starting face-swap preview', {
        userId,
        characterAssetId: normalizedCharacterAssetId,
      });

      const swapResult = await faceSwapService.swap({
        characterPrimaryImageUrl: characterData.primaryImageUrl,
        targetCompositionUrl: normalizedTargetImageUrl,
        ...(typeof aspectRatio === 'string' ? { aspectRatio } : {}),
      });

      const responsePayload = {
        faceSwapUrl: swapResult.swappedImageUrl,
        creditsDeducted: FACE_SWAP_CREDIT_COST,
      };

      const responseBody = {
        success: true,
        data: responsePayload,
        ...responsePayload,
      } as Record<string, unknown>;

      if (idempotencyRecordId && requestIdempotencyService) {
        await requestIdempotencyService.markCompleted({
          recordId: idempotencyRecordId,
          snapshot: {
            statusCode: 200,
            body: responseBody,
          },
        });
      }

      return res.status(200).json(responseBody);
    } catch (error) {
      await refundWithGuard({
        userCreditService,
        userId,
        amount: FACE_SWAP_CREDIT_COST,
        refundKey,
        reason: 'face swap preview failed',
        metadata: {
          characterAssetId: normalizedCharacterAssetId,
        },
      });
      const message = error instanceof Error ? error.message : String(error);
      log.error('Face-swap preview failed', error as Error, {
        userId,
        characterAssetId: normalizedCharacterAssetId,
      });
      return await respondWithError(500, {
        error: 'Face-swap failed',
        code: GENERATION_ERROR_CODES.GENERATION_FAILED,
        details: `Failed to composite character face: ${message}`,
      });
    }
  };
