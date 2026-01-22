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

const KEYFRAME_CREDIT_COST = 2;

type VideoGenerateServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService' | 'videoJobStore' | 'userCreditService' | 'keyframeService' | 'assetService'
>;

export const createVideoGenerateHandler = ({
  videoGenerationService,
  videoJobStore,
  userCreditService,
  keyframeService,
  assetService,
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

    const {
      prompt,
      aspectRatio,
      model,
      startImage,
      inputReference,
      generationParams,
      characterAssetId,
      autoKeyframe = true,
    } = parsed.payload;
    const { cleaned: cleanedPrompt, wasStripped: promptWasStripped } =
      stripVideoPreviewPrompt(prompt);
    const userId = await getAuthenticatedUserId(req);
    const requestId = (req as Request & { id?: string }).id;

    logger.info('Video preview request received', {
      operation: 'generateVideoPreview',
      requestId,
      promptLength: cleanedPrompt.length,
      promptWasStripped,
      aspectRatio,
      model,
      hasStartImage: Boolean(startImage),
      hasInputReference: Boolean(inputReference),
      hasCharacterAssetId: Boolean(characterAssetId),
      autoKeyframe,
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

    let resolvedStartImage = startImage;
    let generatedKeyframeUrl: string | null = null;
    let keyframeCost = 0;

    if (characterAssetId && autoKeyframe && !startImage) {
      if (!keyframeService) {
        logger.warn('Keyframe service unavailable, falling back to direct generation', {
          requestId,
          characterAssetId,
        });
      } else if (!assetService) {
        logger.warn('Asset service unavailable, falling back to direct generation', {
          requestId,
          characterAssetId,
        });
      } else {
        try {
          logger.info('Generating IP-Adapter keyframe for character', {
            requestId,
            characterAssetId,
            userId,
          });

          const hasKeyframeCredits = await userCreditService.reserveCredits(
            userId,
            KEYFRAME_CREDIT_COST
          );
          if (!hasKeyframeCredits) {
            return res.status(402).json({
              success: false,
              error: 'Insufficient credits',
              message: `Character-consistent generation requires ${KEYFRAME_CREDIT_COST} credits for keyframe plus video credits.`,
            });
          }
          keyframeCost = KEYFRAME_CREDIT_COST;

          const characterData = await assetService.getAssetForGeneration(userId, characterAssetId);

          if (!characterData.primaryImageUrl) {
            await userCreditService.refundCredits(userId, keyframeCost);
            return res.status(400).json({
              success: false,
              error: 'Character has no reference image',
              message:
                'The character asset must have at least one reference image for face-consistent generation.',
            });
          }

          const keyframeResult = await keyframeService.generateKeyframe({
            prompt: cleanedPrompt,
            character: {
              primaryImageUrl: characterData.primaryImageUrl,
              negativePrompt: characterData.negativePrompt,
              faceEmbedding: characterData.faceEmbedding,
            },
            aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | undefined,
            faceStrength: 0.7,
          });

          resolvedStartImage = keyframeResult.imageUrl;
          generatedKeyframeUrl = keyframeResult.imageUrl;

          logger.info('IP-Adapter keyframe generated successfully', {
            requestId,
            characterAssetId,
            keyframeUrl: generatedKeyframeUrl,
            faceStrength: keyframeResult.faceStrength,
          });
        } catch (error) {
          if (keyframeCost > 0) {
            await userCreditService.refundCredits(userId, keyframeCost);
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            'Keyframe generation failed',
            error instanceof Error ? error : new Error(errorMessage),
            {
              requestId,
              characterAssetId,
            }
          );

          return res.status(500).json({
            success: false,
            error: 'Keyframe generation failed',
            message: `Failed to generate character-consistent keyframe: ${errorMessage}`,
          });
        }
      }
    }

    const availability = videoGenerationService.getModelAvailability(model);
    if (!availability.available) {
      if (keyframeCost > 0) {
        await userCreditService.refundCredits(userId, keyframeCost);
      }
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
    const costModel = availability.resolvedModelId || model;

    const normalized = normalizeGenerationParams({
      generationParams,
      operation,
      requestId: requestId || 'unknown',
      userId,
      ...(model ? { targetModel: model } : {}),
    });

    if (normalized.error) {
      if (keyframeCost > 0) {
        await userCreditService.refundCredits(userId, keyframeCost);
      }
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

    // Calculate cost based on model and duration (per-second pricing)
    const durationForCost = paramDurationS ?? 8; // Default to 8 seconds if not specified
    const videoCost = getVideoCost(costModel, durationForCost);

    const size =
      typeof paramResolution === 'string' &&
      (/\d+x\d+/i.test(paramResolution) || /p$/i.test(paramResolution))
        ? paramResolution
        : undefined;

    const numFrames =
      typeof paramDurationS === 'number' && typeof paramFps === 'number'
        ? Math.max(1, Math.min(300, Math.round(paramDurationS * paramFps)))
        : undefined;

    const hasCredits = await userCreditService.reserveCredits(userId, videoCost);
    if (!hasCredits) {
      if (keyframeCost > 0) {
        await userCreditService.refundCredits(userId, keyframeCost);
      }
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `This generation requires ${videoCost} credits${keyframeCost > 0 ? ` (plus ${keyframeCost} already reserved for keyframe)` : ''}.`,
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
    if (resolvedStartImage) {
      options.startImage = resolvedStartImage;
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
      videoCost,
      keyframeCost,
      totalCost: videoCost + keyframeCost,
      usedKeyframe: Boolean(generatedKeyframeUrl),
    });

    try {
      const job = await videoJobStore.createJob({
        userId,
        request: {
          prompt: cleanedPrompt,
          options,
        },
        creditsReserved: videoCost,
      });

      logger.info(`${operation} queued`, {
        operation,
        requestId,
        userId,
        jobId: job.id,
        videoCost,
        keyframeCost,
        keyframeUrl: generatedKeyframeUrl,
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
        creditsReserved: videoCost,
        creditsDeducted: videoCost + keyframeCost,
        keyframeGenerated: Boolean(generatedKeyframeUrl),
        keyframeUrl: generatedKeyframeUrl,
      });
    } catch (error: unknown) {
      await userCreditService.refundCredits(userId, videoCost);
      if (keyframeCost > 0) {
        await userCreditService.refundCredits(userId, keyframeCost);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);

      logger.error(`${operation} failed`, errorInstance, {
        operation,
        requestId,
        userId,
        refundAmount: videoCost + keyframeCost,
        statusCode,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Video generation failed',
        message: errorMessage,
      });
    }
  };
