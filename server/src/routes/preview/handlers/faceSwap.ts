import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { assertUrlSafe } from '@server/shared/urlValidation';
import { getAuthenticatedUserId } from '../auth';

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
      return res.status(503).json({
        success: false,
        error: 'Face-swap service is not available',
        message: 'Face-swap preprocessing is not configured',
      });
    }

    const { characterAssetId, targetImageUrl, aspectRatio } = (req.body || {}) as {
      characterAssetId?: unknown;
      targetImageUrl?: unknown;
      aspectRatio?: unknown;
    };

    if (!characterAssetId || typeof characterAssetId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'characterAssetId must be a string',
      });
    }

    if (!targetImageUrl || typeof targetImageUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'targetImageUrl must be a string URL',
      });
    }

    const normalizedCharacterAssetId = characterAssetId.trim();
    const normalizedTargetImageUrl = targetImageUrl.trim();
    if (!normalizedCharacterAssetId) {
      return res.status(400).json({
        success: false,
        error: 'characterAssetId must be a non-empty string',
      });
    }

    if (!normalizedTargetImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'targetImageUrl must be a non-empty string URL',
      });
    }

    try {
      assertUrlSafe(normalizedTargetImageUrl, 'targetImageUrl');
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetImageUrl',
        message: error instanceof Error ? error.message : 'URL validation failed',
      });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to preview face swaps.',
      });
    }

    if (!userCreditService) {
      log.error('User credit service is not available - blocking face swap preview', undefined, {
        path: req.path,
      });
      return res.status(503).json({
        success: false,
        error: 'Face-swap service is not available',
        message: 'Credit service is not configured',
      });
    }

    const hasCredits = await userCreditService.reserveCredits(userId, FACE_SWAP_CREDIT_COST);
    if (!hasCredits) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `Face-swap preview requires ${FACE_SWAP_CREDIT_COST} credits.`,
      });
    }

    try {
      const characterData = await assetService.getAssetForGeneration(
        userId,
        normalizedCharacterAssetId
      );

      if (!characterData.primaryImageUrl) {
        await userCreditService.refundCredits(userId, FACE_SWAP_CREDIT_COST);
        return res.status(400).json({
          success: false,
          error: 'Character has no reference image',
          message: 'The character asset must have a reference image for face-swap.',
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
      await userCreditService.refundCredits(userId, FACE_SWAP_CREDIT_COST);
      const message = error instanceof Error ? error.message : String(error);
      log.error('Face-swap preview failed', error as Error, {
        userId,
        characterAssetId: normalizedCharacterAssetId,
      });
      return res.status(500).json({
        success: false,
        error: 'Face-swap failed',
        message: `Failed to composite character face: ${message}`,
      });
    }
  };
