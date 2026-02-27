import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import type { PreviewRoutesServices } from '@routes/types';
import { buildVideoContentUrl } from '../content';
import { getWorkflowWatchdogTimeoutMs } from '@services/video-generation/providers/timeoutPolicy';

type VideoJobsServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService' | 'videoJobStore' | 'videoContentAccessService' | 'storageService'
>;

function estimateProgress(status: string, createdAtMs: number): number | null {
  if (status === 'completed') return 100;
  if (status === 'failed') return null;
  if (status === 'queued') return 5;
  // 'processing': estimate 10–95 based on elapsed time (assume ~3 min typical)
  const elapsedMs = Date.now() - createdAtMs;
  const typicalMs = 180_000; // 3 minutes
  const raw = 10 + Math.floor((elapsedMs / typicalMs) * 85);
  return Math.max(10, Math.min(95, raw));
}

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
      ...(job.requestId ? { requestId: job.requestId } : {}),
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
      if (job.result.resolvedAspectRatio) {
        response.resolvedAspectRatio = job.result.resolvedAspectRatio;
      }
    }

    if (job.status === 'failed') {
      response.error = job.error?.message || 'Video generation failed';
      if (job.error?.code) {
        response.errorCode = job.error.code;
      }
      if (job.error?.category) {
        response.errorCategory = job.error.category;
      }
      if (typeof job.error?.retryable === 'boolean') {
        response.errorRetryable = job.error.retryable;
      }
      if (job.error?.stage) {
        response.errorStage = job.error.stage;
      }
      if (job.error?.provider) {
        response.errorProvider = job.error.provider;
      }
      if (typeof job.error?.attempt === 'number') {
        response.errorAttempt = job.error.attempt;
      }
    }

    response.progress = estimateProgress(job.status, job.createdAtMs);
    response.createdAtMs = job.createdAtMs;
    response.attempts = job.attempts;
    response.maxAttempts = job.maxAttempts;
    response.serverTimeoutMs = getWorkflowWatchdogTimeoutMs();
    if (typeof job.lastHeartbeatAtMs === 'number') {
      response.lastHeartbeatAtMs = job.lastHeartbeatAtMs;
    }
    if (typeof job.releasedAtMs === 'number') {
      response.releasedAtMs = job.releasedAtMs;
    }
    if (job.releaseReason) {
      response.releaseReason = job.releaseReason;
    }

    return res.json(response);
  };
