import type { Request, Response } from 'express';
import type { PreviewRoutesServices } from '@routes/types';

type VideoAssetViewServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService' | 'videoJobStore' | 'storageService'
>;

export const createVideoAssetViewHandler = ({
  videoGenerationService,
  videoJobStore,
  storageService,
}: VideoAssetViewServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!videoGenerationService) {
      return res.status(503).json({
        success: false,
        error: 'Video generation service is not available',
      });
    }

    const userId = (req as Request & { user?: { uid?: string } }).user?.uid ?? null;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to access preview videos.',
      });
    }

    const assetId =
      typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'assetId is required',
      });
    }

    if (assetId.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assetId',
      });
    }

    if (videoJobStore) {
      const job = await videoJobStore.findJobByAssetId(assetId);
      if (job?.result?.storagePath) {
        if (job.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'This video does not belong to the authenticated user.',
          });
        }

        try {
          if (!storageService) {
            throw new Error('storage unavailable');
          }
          const { viewUrl, expiresAt, storagePath } = await storageService.getViewUrl(
            userId,
            job.result.storagePath
          );
          return res.json({
            success: true,
            data: {
              viewUrl,
              expiresAt,
              storagePath,
              assetId,
              source: 'storage',
            },
          });
        } catch {
          // Fall through to video preview bucket when storage view fails.
        }
      }
    }

    const viewUrl = await videoGenerationService.getVideoUrl(assetId);
    if (!viewUrl) {
      return res.status(404).json({
        success: false,
        error: 'Video asset not found',
      });
    }

    return res.json({
      success: true,
      data: {
        viewUrl,
        assetId,
        source: 'preview',
      },
    });
  };
