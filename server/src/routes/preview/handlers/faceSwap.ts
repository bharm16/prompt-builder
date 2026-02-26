import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { assertUrlSafe } from '@server/shared/urlValidation';
import { sendApiError } from '@middleware/apiErrorResponse';
import { GENERATION_ERROR_CODES } from '@routes/generationErrorCodes';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';

const FACE_SWAP_CREDIT_COST = 2;
const log = logger.child({ route: 'preview.faceSwap' });

type FaceSwapServices = Pick<
  PreviewRoutesServices,
  'faceSwapService' | 'assetService' | 'userCreditService'
>;

export const createFaceSwapPreviewHandler = ({
  faceSwapService,
  assetService,
  userCreditService,
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
    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return sendApiError(res, req, 401, {
        error: 'Authentication required',
        code: GENERATION_ERROR_CODES.AUTH_REQUIRED,
        details: 'You must be logged in to preview face swaps.',
      });
    }

    if (!userCreditService) {
      log.error('User credit service is not available - blocking face swap preview', undefined, {
        path: req.path,
      });
      return sendApiError(res, req, 503, {
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
      return sendApiError(res, req, 402, {
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
        return sendApiError(res, req, 400, {
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

      return res.status(200).json({
        success: true,
        data: responsePayload,
        ...responsePayload,
      });
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
      return sendApiError(res, req, 500, {
        error: 'Face-swap failed',
        code: GENERATION_ERROR_CODES.GENERATION_FAILED,
        details: `Failed to composite character face: ${message}`,
      });
    }
  };
