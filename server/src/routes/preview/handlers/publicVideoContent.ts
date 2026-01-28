import type { Request, Response } from 'express';
import type { PreviewRoutesServices } from '@routes/types';
import { sendVideoContent } from '@routes/preview/videoRequest';
import { extractVideoContentToken } from '../content';

type PublicVideoContentServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService' | 'videoContentAccessService'
>;

export const createPublicVideoContentHandler = ({
  videoGenerationService,
  videoContentAccessService,
}: PublicVideoContentServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!videoGenerationService) {
      return res.status(503).json({
        success: false,
        error: 'Video generation service is not available',
      });
    }

    if (!videoContentAccessService) {
      return res.status(503).json({
        success: false,
        error: 'Video access tokens are not configured',
      });
    }

    const { contentId } = req.params as { contentId?: string };
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'contentId is required',
      });
    }

    const token = extractVideoContentToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
      });
    }

    const tokenPayload = videoContentAccessService.verifyToken(token, contentId);
    if (!tokenPayload) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired access token',
      });
    }

    const entry = await videoGenerationService.getVideoContent(contentId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Video content not found or expired',
      });
    }

    return sendVideoContent(res, entry);
  };
