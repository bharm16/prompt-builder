import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import { parseVideoPreviewRequest } from '@routes/preview/videoRequest';
import { VIDEO_MODELS } from '@config/modelConfig';
import { sendApiError } from '@middleware/apiErrorResponse';
import { GENERATION_ERROR_CODES } from '@routes/generationErrorCodes';
import type { VideoModelId } from '@services/video-generation/types';
import { resolveModelId as resolveCapabilityModelId } from '@services/capabilities/modelProviders';
import { assertUrlSafe } from '@server/shared/urlValidation';
import { scheduleInlineVideoPreviewProcessing } from '../inlineProcessor';
import { stripVideoPreviewPrompt } from '../prompt';
import { extractMotionMeta } from './video-generate/motion';
import { buildVideoRequestPlan, createModelUnavailableError } from './video-generate/requestPlan';
import { runVideoPreprocessing } from './video-generate/preprocessing';
import { createVideoRefundManager } from './video-generate/refundManager';
import { extractPromptTriggers, resolvePromptTriggers } from './video-generate/triggerResolution';
import type { VideoGenerateServices } from './video-generate/types';

const log = logger.child({ route: 'preview.videoGenerate' });

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (!('statusCode' in value)) {
    return false;
  }
  const statusCode = (value as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' && Number.isFinite(statusCode);
};

export const createVideoGenerateHandler = ({
  videoGenerationService,
  videoJobStore,
  userCreditService,
  storageService,
  keyframeService,
  faceSwapService,
  assetService,
}: VideoGenerateServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!videoGenerationService || !videoJobStore) {
      return sendApiError(res, req, 503, {
        error: 'Video generation service is not available',
        code: GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE,
        details: 'Video generation queue is not configured',
      });
    }

    const parsed = parseVideoPreviewRequest(req.body);
    if (!parsed.ok) {
      return sendApiError(res, req, parsed.status, {
        error: parsed.error,
        code: GENERATION_ERROR_CODES.INVALID_REQUEST,
      });
    }

    const {
      prompt,
      aspectRatio,
      model,
      startImage,
      inputReference,
      generationParams,
      characterAssetId: requestedCharacterAssetId,
      autoKeyframe = true,
      faceSwapAlreadyApplied = false,
    } = parsed.payload;
    let characterAssetId = requestedCharacterAssetId;

    if (startImage) {
      try {
        assertUrlSafe(startImage, 'startImage');
      } catch (err) {
        return sendApiError(res, req, 400, {
          error: 'Invalid startImage URL',
          code: GENERATION_ERROR_CODES.INVALID_REQUEST,
          details: err instanceof Error ? err.message : 'URL validation failed',
        });
      }
    }
    if (inputReference) {
      try {
        assertUrlSafe(inputReference, 'inputReference');
      } catch (err) {
        return sendApiError(res, req, 400, {
          error: 'Invalid inputReference URL',
          code: GENERATION_ERROR_CODES.INVALID_REQUEST,
          details: err instanceof Error ? err.message : 'URL validation failed',
        });
      }
    }

    let { cleaned: cleanedPrompt, wasStripped: promptWasStripped } = stripVideoPreviewPrompt(prompt);
    const userId = (req as Request & { user?: { uid?: string } }).user?.uid ?? null;
    const requestId = (req as Request & { id?: string }).id;
    const rawMotionMeta = extractMotionMeta(generationParams);
    const promptTriggers = extractPromptTriggers(cleanedPrompt);
    const uniquePromptTriggerCount = new Set(promptTriggers).size;
    const hasPromptTriggers = uniquePromptTriggerCount > 0;

    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return sendApiError(res, req, 401, {
        error: 'Authentication required',
        code: GENERATION_ERROR_CODES.AUTH_REQUIRED,
        details: 'You must be logged in to generate videos.',
      });
    }

    const triggerResolution = await resolvePromptTriggers({
      cleanedPrompt,
      hasPromptTriggers,
      uniquePromptTriggerCount,
      userId,
      requestId,
      characterAssetId,
      assetService,
      log,
    });

    if (!triggerResolution.ok) {
      return sendApiError(res, req, triggerResolution.error.status, triggerResolution.error.payload);
    }

    cleanedPrompt = triggerResolution.value.cleanedPrompt;
    characterAssetId = triggerResolution.value.characterAssetId;

    log.info('Video preview request received', {
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
      faceSwapAlreadyApplied,
      hasPromptTriggers,
      uniquePromptTriggerCount,
      promptExpandedFromTrigger: triggerResolution.value.promptExpandedFromTrigger,
      resolvedAssetCount: triggerResolution.value.resolvedAssetCount,
      resolvedCharacterCount: triggerResolution.value.resolvedCharacterCount,
      ...rawMotionMeta,
    });

    if (!userCreditService) {
      log.error('User credit service is not available - blocking paid feature access', undefined, {
        path: req.path,
      });
      return sendApiError(res, req, 503, {
        error: 'Video generation service is not available',
        code: GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE,
        details: 'Credit service is not configured',
      });
    }

    const refunds = createVideoRefundManager({
      userCreditService,
      userId,
      requestId,
      cleanedPrompt,
      model,
    });

    const preprocessing = await runVideoPreprocessing({
      requestId,
      userId,
      startImage,
      characterAssetId,
      autoKeyframe,
      faceSwapAlreadyApplied,
      aspectRatio,
      cleanedPrompt,
      services: {
        userCreditService,
        keyframeService,
        faceSwapService,
        assetService,
      },
      refunds,
      log,
    });

    if (preprocessing.error) {
      return sendApiError(res, req, preprocessing.error.status, preprocessing.error.payload);
    }

    const resolvedStartImage = preprocessing.resolvedStartImage;
    const generatedKeyframeUrl = preprocessing.generatedKeyframeUrl;
    const swappedImageUrl = preprocessing.swappedImageUrl;
    characterAssetId = preprocessing.characterAssetId;

    const availability = videoGenerationService.getModelAvailability(model);
    if (!availability.available) {
      await refunds.refundKeyframeCredits('video model unavailable after keyframe reservation');
      await refunds.refundFaceSwapCredits('video model unavailable after face-swap reservation');

      const snapshot = videoGenerationService.getAvailabilitySnapshot(
        Object.values(VIDEO_MODELS) as VideoModelId[]
      );
      const availableCapabilityModels = Array.from(
        new Set(
          snapshot.availableModelIds
            .map((modelId) => resolveCapabilityModelId(modelId))
            .filter((modelId): modelId is string => typeof modelId === 'string' && modelId.length > 0)
        )
      );

      const unavailable = createModelUnavailableError({
        availability,
        availableModelIds: snapshot.availableModelIds,
        availableCapabilityModels,
      });
      return sendApiError(res, req, unavailable.status, unavailable.payload);
    }

    const operation = 'generateVideoPreview';
    const costModel = availability.resolvedModelId || model;

    const planResult = buildVideoRequestPlan({
      generationParams,
      model,
      operation,
      requestId: requestId || 'unknown',
      userId,
      costModel,
      cleanedPrompt,
      resolvedStartImage,
      inputReference,
      aspectRatio,
      characterAssetId,
      faceSwapAlreadyApplied,
      swappedImageUrl,
    });

    if (!planResult.ok) {
      await refunds.refundKeyframeCredits('video request normalization failed after keyframe reservation');
      await refunds.refundFaceSwapCredits('video request normalization failed after face-swap reservation');
      return sendApiError(res, req, planResult.error.status, planResult.error.payload);
    }

    const plan = planResult.value;

    log.info('Resolved motion context for video generation', {
      operation: 'resolveMotionContext',
      requestId,
      userId,
      hasStartImage: Boolean(resolvedStartImage),
      hasInputReference: Boolean(inputReference),
      isI2VRequest: Boolean(resolvedStartImage || inputReference),
      rawHasCameraMotion: rawMotionMeta.hasCameraMotion,
      rawCameraMotionId: rawMotionMeta.cameraMotionId,
      rawHasSubjectMotion: rawMotionMeta.hasSubjectMotion,
      rawSubjectMotionLength: rawMotionMeta.subjectMotionLength,
      normalizedHasCameraMotion: plan.normalizedMotionMeta.hasCameraMotion,
      normalizedCameraMotionId: plan.normalizedMotionMeta.cameraMotionId,
      normalizedHasSubjectMotion: plan.normalizedMotionMeta.hasSubjectMotion,
      normalizedSubjectMotionLength: plan.normalizedMotionMeta.subjectMotionLength,
      resolvedCameraMotionId: plan.motionContext.cameraMotionId,
      resolvedCameraMotionText: plan.motionContext.cameraMotionText,
      resolvedSubjectMotionLength: plan.motionContext.subjectMotion?.length ?? 0,
      disablePromptExtend: plan.disablePromptExtend,
      motionGuidanceAppended: plan.motionGuidanceAppended,
      promptLengthBeforeMotion: plan.promptLengthBeforeMotion,
      promptLengthAfterMotion: plan.promptLengthAfterMotion,
    });

    if (plan.disablePromptExtend) {
      log.info('Disabling Wan prompt_extend for I2V camera motion', {
        operation: 'configureWanPromptExtend',
        requestId,
        userId,
        cameraMotionId: plan.motionContext.cameraMotionId,
        hasStartImage: Boolean(resolvedStartImage),
        hasInputReference: Boolean(inputReference),
      });
    }

    const hasCredits = await userCreditService.reserveCredits(userId, plan.videoCost);
    if (!hasCredits) {
      await refunds.refundKeyframeCredits('video credits insufficient after keyframe reservation');
      await refunds.refundFaceSwapCredits('video credits insufficient after face-swap reservation');
      const preprocessingCost = refunds.ledger.keyframeCost + refunds.ledger.faceSwapCost;
      return sendApiError(res, req, 402, {
        error: 'Insufficient credits',
        code: GENERATION_ERROR_CODES.INSUFFICIENT_CREDITS,
        details: `This generation requires ${plan.videoCost} credits${preprocessingCost > 0 ? ` (plus ${preprocessingCost} already reserved for preprocessing)` : ''}.`,
      });
    }
    refunds.setVideoCost(plan.videoCost);

    log.debug('Queueing operation.', {
      operation,
      requestId,
      userId,
      promptLength: plan.promptWithMotion.length,
      promptLengthBeforeMotion: plan.promptLengthBeforeMotion,
      promptLengthAfterMotion: plan.promptLengthAfterMotion,
      motionGuidanceAppended: plan.motionGuidanceAppended,
      promptWasStripped,
      aspectRatio,
      model,
      videoCost: refunds.ledger.videoCost,
      keyframeCost: refunds.ledger.keyframeCost,
      faceSwapCost: refunds.ledger.faceSwapCost,
      totalCost: refunds.ledger.videoCost + refunds.ledger.keyframeCost + refunds.ledger.faceSwapCost,
      usedKeyframe: Boolean(generatedKeyframeUrl),
      faceSwapApplied: Boolean(swappedImageUrl),
      hasCameraMotion: Boolean(plan.motionContext.cameraMotionId),
      cameraMotionId: plan.motionContext.cameraMotionId,
      hasSubjectMotion: Boolean(plan.motionContext.subjectMotion),
      subjectMotionLength: plan.motionContext.subjectMotion?.length ?? 0,
      promptExtend: plan.options.promptExtend ?? null,
    });

    try {
      const job = await videoJobStore.createJob({
        userId,
        request: {
          prompt: plan.promptWithMotion,
          options: plan.options,
        },
        creditsReserved: refunds.ledger.videoCost,
      });

      log.info('Operation queued.', {
        operation,
        requestId,
        userId,
        jobId: job.id,
        videoCost: refunds.ledger.videoCost,
        keyframeCost: refunds.ledger.keyframeCost,
        faceSwapCost: refunds.ledger.faceSwapCost,
        keyframeUrl: generatedKeyframeUrl,
        faceSwapUrl: swappedImageUrl,
        hasCameraMotion: Boolean(plan.motionContext.cameraMotionId),
        cameraMotionId: plan.motionContext.cameraMotionId,
        hasSubjectMotion: Boolean(plan.motionContext.subjectMotion),
        subjectMotionLength: plan.motionContext.subjectMotion?.length ?? 0,
        promptLengthBeforeMotion: plan.promptLengthBeforeMotion,
        promptLengthAfterMotion: plan.promptLengthAfterMotion,
        motionGuidanceAppended: plan.motionGuidanceAppended,
      });

      scheduleInlineVideoPreviewProcessing({
        jobId: job.id,
        requestId,
        videoJobStore,
        videoGenerationService,
        userCreditService,
        storageService: storageService ?? null,
      });

      const responsePayload = {
        jobId: job.id,
        status: job.status,
        creditsReserved: refunds.ledger.videoCost,
        creditsDeducted: refunds.ledger.videoCost + refunds.ledger.keyframeCost + refunds.ledger.faceSwapCost,
        keyframeGenerated: Boolean(generatedKeyframeUrl),
        keyframeUrl: generatedKeyframeUrl,
        faceSwapApplied: Boolean(swappedImageUrl),
        faceSwapUrl: swappedImageUrl,
      };

      return res.status(202).json({
        success: true,
        data: responsePayload,
        ...responsePayload,
      });
    } catch (error: unknown) {
      await refunds.refundVideoCredits('video queueing failed');
      await refunds.refundKeyframeCredits('video queueing failed after keyframe reservation');
      await refunds.refundFaceSwapCredits('video queueing failed after face-swap reservation');

      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = hasStatusCode(error) ? error.statusCode : 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);
      const code =
        statusCode === 503
          ? GENERATION_ERROR_CODES.SERVICE_UNAVAILABLE
          : GENERATION_ERROR_CODES.GENERATION_FAILED;

      log.error('Operation failed.', errorInstance, {
        operation,
        requestId,
        userId,
        refundAmount: refunds.ledger.videoCost + refunds.ledger.keyframeCost + refunds.ledger.faceSwapCost,
        statusCode,
      });

      return sendApiError(res, req, statusCode, {
        error: 'Video generation failed',
        code,
        details: errorMessage,
      });
    }
  };
