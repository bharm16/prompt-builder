import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import { parseVideoPreviewRequest } from '@routes/preview/videoRequest';
import { getVideoCost } from '@config/modelCosts';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PreviewRoutesServices } from '@routes/types';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import { getAuthenticatedUserId } from '../auth';
import { getCapabilityModelIds } from '../availability';
import { scheduleInlineVideoPreviewProcessing } from '../inlineProcessor';
import { stripVideoPreviewPrompt } from '../prompt';

type VideoGenerateServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService' | 'videoJobStore' | 'userCreditService'
>;

export const createVideoGenerateHandler = ({
  videoGenerationService,
  videoJobStore,
  userCreditService,
}: VideoGenerateServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!videoGenerationService || !videoJobStore) {
      return res.status(503).json({
        success: false,
        error: 'Video generation service is not available',
        message: 'Video generation queue is not configured',
      });
    }

    const parsed = parseVideoPreviewRequest(req.body);
    if (!parsed.ok) {
      return res.status(parsed.status).json({
        success: false,
        error: parsed.error,
      });
    }

    const { prompt, aspectRatio, model, startImage, inputReference, generationParams } =
      parsed.payload;
    const { cleaned: cleanedPrompt, wasStripped: promptWasStripped } =
      stripVideoPreviewPrompt(prompt);
    const userId = await getAuthenticatedUserId(req);

    logger.info('Video preview request received', {
      operation: 'generateVideoPreview',
      requestId: (req as Request & { id?: string }).id,
      promptLength: cleanedPrompt.length,
      promptWasStripped,
      aspectRatio,
      model,
      hasStartImage: Boolean(startImage),
      hasInputReference: Boolean(inputReference),
    });

    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to generate videos.',
      });
    }

    if (!userCreditService) {
      logger.error('User credit service is not available - blocking paid feature access', undefined, {
        path: req.path,
      });
      return res.status(503).json({
        success: false,
        error: 'Video generation service is not available',
        message: 'Credit service is not configured',
      });
    }

    const availability = videoGenerationService.getModelAvailability(model);
    if (!availability.available) {
      const report = videoGenerationService.getAvailabilityReport(getCapabilityModelIds());
      const statusCode = availability.statusCode || 424;
      return res.status(statusCode).json({
        success: false,
        error: 'Video model not available',
        message: availability.message || 'Requested video model is not available',
        model: model || 'auto',
        reason: availability.reason,
        requiredKey: availability.requiredKey,
        resolvedModelId: availability.resolvedModelId,
        availableModels: report.availableModels,
      });
    }

    const operation = 'generateVideoPreview';
    const requestId = (req as Request & { id?: string }).id;
    const costModel = availability.resolvedModelId || model;
    const estimatedCost = getVideoCost(costModel);

    const normalized = normalizeGenerationParams({
      generationParams,
      operation,
      requestId: requestId || 'unknown',
      userId,
      ...(model ? { targetModel: model } : {}),
    });

    if (normalized.error) {
      return res.status(normalized.error.status).json({
        success: false,
        error: normalized.error.error,
        message: normalized.error.details,
      });
    }

    const normalizedParams = normalized.normalizedGenerationParams as Record<string, unknown> | null;
    const paramAspectRatio =
      normalizedParams && typeof normalizedParams.aspect_ratio === 'string'
        ? (normalizedParams.aspect_ratio as VideoGenerationOptions['aspectRatio'])
        : undefined;
    const paramFps =
      normalizedParams && typeof normalizedParams.fps === 'number' ? normalizedParams.fps : undefined;
    const paramDurationS =
      normalizedParams && typeof normalizedParams.duration_s === 'number'
        ? normalizedParams.duration_s
        : undefined;
    const paramResolution =
      normalizedParams && typeof normalizedParams.resolution === 'string'
        ? normalizedParams.resolution
        : undefined;

    const seconds =
      paramDurationS != null && ['4', '8', '12'].includes(String(paramDurationS))
        ? (String(paramDurationS) as VideoGenerationOptions['seconds'])
        : undefined;

    const size =
      typeof paramResolution === 'string' &&
      (/\d+x\d+/i.test(paramResolution) || /p$/i.test(paramResolution))
        ? paramResolution
        : undefined;

    const numFrames =
      typeof paramDurationS === 'number' && typeof paramFps === 'number'
        ? Math.max(1, Math.min(300, Math.round(paramDurationS * paramFps)))
        : undefined;

    const hasCredits = await userCreditService.reserveCredits(userId, estimatedCost);
    if (!hasCredits) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `This generation requires ${estimatedCost} credits.`,
      });
    }

    const options: VideoGenerationOptions = {};
    const resolvedAspectRatio = paramAspectRatio || aspectRatio;
    if (resolvedAspectRatio) {
      options.aspectRatio = resolvedAspectRatio as NonNullable<VideoGenerationOptions['aspectRatio']>;
    }
    if (model) {
      options.model = model as NonNullable<VideoGenerationOptions['model']>;
    }
    if (startImage) {
      options.startImage = startImage;
    }
    if (inputReference) {
      options.inputReference = inputReference;
    }
    if (typeof paramFps === 'number') {
      options.fps = paramFps;
    }
    if (seconds) {
      options.seconds = seconds;
    }
    if (size) {
      options.size = size;
    }
    if (typeof numFrames === 'number') {
      options.numFrames = numFrames;
    }

    logger.debug(`Queueing ${operation}`, {
      operation,
      requestId,
      userId,
      promptLength: cleanedPrompt.length,
      promptWasStripped,
      aspectRatio,
      model,
      estimatedCost,
    });

    try {
      const job = await videoJobStore.createJob({
        userId,
        request: {
          prompt: cleanedPrompt,
          options,
        },
        creditsReserved: estimatedCost,
      });

      logger.info(`${operation} queued`, {
        operation,
        requestId,
        userId,
        jobId: job.id,
        cost: estimatedCost,
      });

      scheduleInlineVideoPreviewProcessing({
        jobId: job.id,
        requestId,
        videoJobStore,
        videoGenerationService,
        userCreditService,
      });

      return res.status(202).json({
        success: true,
        jobId: job.id,
        status: job.status,
        creditsReserved: estimatedCost,
        creditsDeducted: estimatedCost,
      });
    } catch (error: unknown) {
      await userCreditService.refundCredits(userId, estimatedCost);

      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);

      logger.error(`${operation} failed`, errorInstance, {
        operation,
        requestId,
        userId,
        refundAmount: estimatedCost,
        statusCode,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Video generation failed',
        message: errorMessage,
      });
    }
  };
