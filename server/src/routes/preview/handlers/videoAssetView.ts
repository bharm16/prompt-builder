import type { Request, Response } from 'express';
import type { PreviewRoutesServices } from '@routes/types';
import { getAuthenticatedUserId } from '../auth';

type VideoAssetViewServices = Pick<PreviewRoutesServices, 'videoGenerationService'>;

export const createVideoAssetViewHandler = ({
  videoGenerationService,
}: VideoAssetViewServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!videoGenerationService) {
      return res.status(503).json({
        success: false,
        error: 'Video generation service is not available',
      });
    }

    const userId = await getAuthenticatedUserId(req);
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
      },
    });
  };

