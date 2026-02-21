import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import type { PreviewRoutesServices } from '@routes/types';
import { buildVideoContentUrl } from '../content';

type VideoJobsServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService' | 'videoJobStore' | 'videoContentAccessService' | 'storageService'
>;

export const createVideoJobsHandler = ({
  videoGenerationService,
  videoJobStore,
  videoContentAccessService,
  storageService,
}: VideoJobsServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    if (!videoGenerationService || !videoJobStore) {
      return res.status(503).json({
        success: false,
        error: 'Video generation service is not available',
      });
    }

    const userId = (req as Request & { user?: { uid?: string } }).user?.uid ?? null;
    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to view video jobs.',
      });
    }

    const { jobId } = req.params as { jobId?: string };
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId is required',
      });
    }

    const job = await videoJobStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Video job not found',
      });
    }

    if (job.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'This job does not belong to the authenticated user.',
      });
    }

    const response: Record<string, unknown> = {
      success: true,
      jobId: job.id,
      status: job.status,
      creditsReserved: job.creditsReserved,
      creditsDeducted: job.creditsReserved,
    };

    if (job.status === 'completed' && job.result) {
      let rawUrl: string | null | undefined = null;
      let viewUrl: string | undefined;

      if (job.result.storagePath) {
        try {
          const signed = storageService
            ? await storageService.getViewUrl(userId, job.result.storagePath)
            : null;
          if (!signed) {
            throw new Error('storage unavailable');
          }
          viewUrl = signed.viewUrl;
          rawUrl = signed.viewUrl;
          response.storagePath = job.result.storagePath;
          response.viewUrlExpiresAt = signed.expiresAt;
        } catch {
          // Ignore and fall back to preview bucket URL.
        }
      }

      if (!rawUrl) {
        const freshUrl = await videoGenerationService.getVideoUrl(job.result.assetId);
        rawUrl = freshUrl || job.result.videoUrl;
      }

      const secureUrl = buildVideoContentUrl(
        videoContentAccessService,
        rawUrl,
        job.result.assetId,
        userId
      );
      if (secureUrl) {
        response.videoUrl = secureUrl;
      }
      response.assetId = job.result.assetId;
      response.contentType = job.result.contentType;
      if (job.result.viewUrl) {
        response.viewUrl = job.result.viewUrl;
      }
      if (typeof job.result.sizeBytes === 'number') {
        response.sizeBytes = job.result.sizeBytes;
      }
      if (job.result.inputMode) {
        response.inputMode = job.result.inputMode;
      }
      if (job.result.startImageUrl) {
        response.startImageUrl = job.result.startImageUrl;
      }
    }

    if (job.status === 'failed') {
      response.error = job.error?.message || 'Video generation failed';
    }

    return res.json(response);
  };
