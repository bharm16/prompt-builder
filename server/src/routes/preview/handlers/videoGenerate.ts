import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { logger } from '@infrastructure/Logger';
import { parseVideoPreviewRequest } from '@routes/preview/videoRequest';
import { getVideoCost } from '@config/modelCosts';
import { VIDEO_MODELS } from '@config/modelConfig';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PreviewRoutesServices } from '@routes/types';
import type { VideoGenerationOptions, VideoModelId } from '@services/video-generation/types';
import {
  CAMERA_MOTION_DESCRIPTIONS,
  CAMERA_PATHS,
} from '@services/convergence/constants';
import { resolveModelId as resolveCapabilityModelId } from '@services/capabilities/modelProviders';
import { assertUrlSafe } from '@server/shared/urlValidation';
import { getAuthenticatedUserId } from '../auth';
import { scheduleInlineVideoPreviewProcessing } from '../inlineProcessor';
import { stripVideoPreviewPrompt } from '../prompt';

const KEYFRAME_CREDIT_COST = 2;
const FACE_SWAP_CREDIT_COST = 2;
const CAMERA_MOTION_KEY = 'camera_motion_id';
const SUBJECT_MOTION_KEY = 'subject_motion';
const TRIGGER_REGEX = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;
const log = logger.child({ route: 'preview.videoGenerate' });

type VideoGenerateServices = Pick<
  PreviewRoutesServices,
  'videoGenerationService'
  | 'videoJobStore'
  | 'userCreditService'
  | 'keyframeService'
  | 'faceSwapService'
  | 'assetService'
>;

interface MotionContext {
  cameraMotionId: string | null;
  cameraMotionText: string | null;
  subjectMotion: string | null;
}

const normalizeMotionString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toTitleCaseFromId = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveCameraMotionText = (cameraMotionId: string): string => {
  const description = CAMERA_MOTION_DESCRIPTIONS[cameraMotionId];
  if (description) {
    return description;
  }
  const path = CAMERA_PATHS.find((item) => item.id === cameraMotionId);
  if (path?.label) {
    return path.label;
  }
  return toTitleCaseFromId(cameraMotionId);
};

const resolveMotionContext = (
  normalizedParams: Record<string, unknown> | null,
  rawParams: unknown
): MotionContext => {
  const normalizedCameraMotion = normalizeMotionString(
    normalizedParams?.[CAMERA_MOTION_KEY]
  );
  const normalizedSubjectMotion = normalizeMotionString(
    normalizedParams?.[SUBJECT_MOTION_KEY]
  );

  const rawRecord =
    rawParams && typeof rawParams === 'object' ? (rawParams as Record<string, unknown>) : null;
  const rawCameraMotion =
    normalizedCameraMotion ?? normalizeMotionString(rawRecord?.[CAMERA_MOTION_KEY]);
  const rawSubjectMotion =
    normalizedSubjectMotion ?? normalizeMotionString(rawRecord?.[SUBJECT_MOTION_KEY]);

  return {
    cameraMotionId: rawCameraMotion,
    cameraMotionText: rawCameraMotion ? resolveCameraMotionText(rawCameraMotion) : null,
    subjectMotion: rawSubjectMotion,
  };
};

const appendMotionGuidance = (basePrompt: string, motion: MotionContext): string => {
  const guidanceLines: string[] = [];

  if (motion.cameraMotionText) {
    guidanceLines.push(`Camera motion: ${motion.cameraMotionText}`);
  }
  if (motion.subjectMotion) {
    guidanceLines.push(`Subject motion: ${motion.subjectMotion}`);
  }

  if (guidanceLines.length === 0) {
    return basePrompt;
  }

  const trimmedPrompt = basePrompt.trim();
  return `${trimmedPrompt}\n\n${guidanceLines.join('\n')}`;
};

const extractMotionMeta = (params: unknown) => {
  const record =
    params && typeof params === 'object' ? (params as Record<string, unknown>) : null;
  const cameraMotionId = normalizeMotionString(record?.[CAMERA_MOTION_KEY]);
  const subjectMotion = normalizeMotionString(record?.[SUBJECT_MOTION_KEY]);
  return {
    hasCameraMotion: Boolean(cameraMotionId),
    cameraMotionId,
    hasSubjectMotion: Boolean(subjectMotion),
    subjectMotionLength: subjectMotion?.length ?? 0,
  } as const;
};

const extractPromptTriggers = (prompt: string): string[] =>
  Array.from(prompt.matchAll(TRIGGER_REGEX)).map((match) => match[1].toLowerCase());

export const createVideoGenerateHandler = ({
  videoGenerationService,
  videoJobStore,
  userCreditService,
  keyframeService,
  faceSwapService,
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
      characterAssetId: requestedCharacterAssetId,
      autoKeyframe = true,
      faceSwapAlreadyApplied = false,
    } = parsed.payload;
    let characterAssetId = requestedCharacterAssetId;

    // Validate user-provided URLs to prevent SSRF
    if (startImage) {
      try {
        assertUrlSafe(startImage, 'startImage');
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Invalid startImage URL',
          message: err instanceof Error ? err.message : 'URL validation failed',
        });
      }
    }
    if (inputReference) {
      try {
        assertUrlSafe(inputReference, 'inputReference');
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Invalid inputReference URL',
          message: err instanceof Error ? err.message : 'URL validation failed',
        });
      }
    }

    let { cleaned: cleanedPrompt, wasStripped: promptWasStripped } =
      stripVideoPreviewPrompt(prompt);
    const userId = await getAuthenticatedUserId(req);
    const requestId = (req as Request & { id?: string }).id;
    const rawMotionMeta = extractMotionMeta(generationParams);
    const promptTriggers = extractPromptTriggers(cleanedPrompt);
    const uniquePromptTriggerCount = new Set(promptTriggers).size;
    const hasPromptTriggers = uniquePromptTriggerCount > 0;

    if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to generate videos.',
      });
    }

    let resolvedAssetCount = 0;
    let resolvedCharacterCount = 0;
    let promptExpandedFromTrigger = false;

    if (hasPromptTriggers) {
      if (!assetService) {
        log.warn('Asset service unavailable for video trigger resolution', {
          requestId,
          userId,
          uniquePromptTriggerCount,
        });
      } else {
        try {
          const resolvedPrompt = await assetService.resolvePrompt(userId, cleanedPrompt);
          const expandedPrompt = resolvedPrompt.expandedText.trim();
          resolvedAssetCount = resolvedPrompt.assets.length;
          resolvedCharacterCount = resolvedPrompt.characters.length;

          if (expandedPrompt.length > 0 && expandedPrompt !== cleanedPrompt) {
            cleanedPrompt = expandedPrompt;
            promptExpandedFromTrigger = true;
          }

          if (!characterAssetId) {
            characterAssetId = resolvedPrompt.characters[0]?.id;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error(
            'Video prompt trigger resolution failed',
            error instanceof Error ? error : new Error(errorMessage),
            {
              requestId,
              userId,
              uniquePromptTriggerCount,
            }
          );
          return res.status(500).json({
            success: false,
            error: 'Prompt resolution failed',
            message: errorMessage,
          });
        }
      }
    }

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
      promptExpandedFromTrigger,
      resolvedAssetCount,
      resolvedCharacterCount,
      ...rawMotionMeta,
    });

    if (!userCreditService) {
      log.error('User credit service is not available - blocking paid feature access', undefined, {
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
    let swappedImageUrl: string | null = null;
    let keyframeCost = 0;
    let faceSwapCost = 0;

    if (startImage && characterAssetId && faceSwapAlreadyApplied) {
      resolvedStartImage = startImage;
      swappedImageUrl = startImage;
      log.info('Using pre-applied face swap image', {
        requestId,
        characterAssetId,
        hasStartImage: true,
      });
    } else if (startImage && characterAssetId) {
      if (!faceSwapService || !assetService) {
        log.warn('Face-swap service unavailable', {
          requestId,
          characterAssetId,
        });
        return res.status(400).json({
          success: false,
          error: 'Face-swap not available',
          message: 'Character + composition reference requires face-swap service. Use startImage alone for direct i2v, or characterAssetId alone for auto-keyframe.',
        });
      }

      const hasFaceSwapCredits = await userCreditService.reserveCredits(
        userId,
        FACE_SWAP_CREDIT_COST
      );
      if (!hasFaceSwapCredits) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          message: `Character-composition face-swap requires ${FACE_SWAP_CREDIT_COST} credits plus video credits.`,
        });
      }
      faceSwapCost = FACE_SWAP_CREDIT_COST;

      try {
        const characterData = await assetService.getAssetForGeneration(userId, characterAssetId);
        if (!characterData.primaryImageUrl) {
          await userCreditService.refundCredits(userId, faceSwapCost);
          return res.status(400).json({
            success: false,
            error: 'Character has no reference image',
            message: 'The character asset must have a reference image for face-swap.',
          });
        }

        log.info('Performing face-swap preprocessing', {
          requestId,
          characterAssetId,
          hasStartImage: true,
        });

        const swapResult = await faceSwapService.swap({
          characterPrimaryImageUrl: characterData.primaryImageUrl,
          targetCompositionUrl: startImage,
          aspectRatio,
        });

        resolvedStartImage = swapResult.swappedImageUrl;
        swappedImageUrl = swapResult.swappedImageUrl;

        log.info('Face-swap completed', {
          requestId,
          characterAssetId,
          durationMs: swapResult.durationMs,
        });
      } catch (error) {
        await userCreditService.refundCredits(userId, faceSwapCost);
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Face-swap failed', error instanceof Error ? error : new Error(errorMessage), {
          requestId,
          characterAssetId,
        });
        return res.status(500).json({
          success: false,
          error: 'Face-swap failed',
          message: `Failed to composite character face: ${errorMessage}`,
        });
      }
    } else if (characterAssetId && autoKeyframe && !startImage) {
      if (!keyframeService) {
        log.warn('Keyframe service unavailable, falling back to direct generation', {
          requestId,
          characterAssetId,
        });
      } else if (!assetService) {
        log.warn('Asset service unavailable, falling back to direct generation', {
          requestId,
          characterAssetId,
        });
      } else {
        try {
          log.info('Generating PuLID keyframe for character', {
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

          log.info('PuLID keyframe generated successfully', {
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
          log.error(
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
      if (faceSwapCost > 0) {
        await userCreditService.refundCredits(userId, faceSwapCost);
      }
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
      const statusCode = availability.statusCode || 503;
      return res.status(statusCode).json({
        success: false,
        error: 'Video model not available',
        message: availability.message || 'Requested video model is not available',
        model: model || 'auto',
        reason: availability.reason,
        requiredKey: availability.requiredKey,
        resolvedModelId: availability.resolvedModelId,
        availableModels: snapshot.availableModelIds,
        availableCapabilityModels,
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
      if (faceSwapCost > 0) {
        await userCreditService.refundCredits(userId, faceSwapCost);
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

    const motionContext = resolveMotionContext(normalizedParams, generationParams);
    const isI2VRequest = Boolean(resolvedStartImage || inputReference);
    const disablePromptExtend = isI2VRequest && Boolean(motionContext.cameraMotionId);
    const promptWithMotion = appendMotionGuidance(cleanedPrompt, motionContext);
    const normalizedMotionMeta = extractMotionMeta(normalizedParams);
    const promptLengthBeforeMotion = cleanedPrompt.trim().length;
    const promptLengthAfterMotion = promptWithMotion.trim().length;
    const motionGuidanceAppended = promptLengthAfterMotion > promptLengthBeforeMotion;

    log.info('Resolved motion context for video generation', {
      operation: 'resolveMotionContext',
      requestId,
      userId,
      hasStartImage: Boolean(resolvedStartImage),
      hasInputReference: Boolean(inputReference),
      isI2VRequest,
      rawHasCameraMotion: rawMotionMeta.hasCameraMotion,
      rawCameraMotionId: rawMotionMeta.cameraMotionId,
      rawHasSubjectMotion: rawMotionMeta.hasSubjectMotion,
      rawSubjectMotionLength: rawMotionMeta.subjectMotionLength,
      normalizedHasCameraMotion: normalizedMotionMeta.hasCameraMotion,
      normalizedCameraMotionId: normalizedMotionMeta.cameraMotionId,
      normalizedHasSubjectMotion: normalizedMotionMeta.hasSubjectMotion,
      normalizedSubjectMotionLength: normalizedMotionMeta.subjectMotionLength,
      resolvedCameraMotionId: motionContext.cameraMotionId,
      resolvedCameraMotionText: motionContext.cameraMotionText,
      resolvedSubjectMotionLength: motionContext.subjectMotion?.length ?? 0,
      disablePromptExtend,
      motionGuidanceAppended,
      promptLengthBeforeMotion,
      promptLengthAfterMotion,
    });

    if (disablePromptExtend) {
      log.info('Disabling Wan prompt_extend for I2V camera motion', {
        operation: 'configureWanPromptExtend',
        requestId,
        userId,
        cameraMotionId: motionContext.cameraMotionId,
        hasStartImage: Boolean(resolvedStartImage),
        hasInputReference: Boolean(inputReference),
      });
    }

    const hasCredits = await userCreditService.reserveCredits(userId, videoCost);
    if (!hasCredits) {
      if (keyframeCost > 0) {
        await userCreditService.refundCredits(userId, keyframeCost);
      }
      if (faceSwapCost > 0) {
        await userCreditService.refundCredits(userId, faceSwapCost);
      }
      const preprocessingCost = keyframeCost + faceSwapCost;
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `This generation requires ${videoCost} credits${preprocessingCost > 0 ? ` (plus ${preprocessingCost} already reserved for preprocessing)` : ''}.`,
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
    if (characterAssetId) {
      options.characterAssetId = characterAssetId;
    }
    if (faceSwapAlreadyApplied) {
      options.faceSwapAlreadyApplied = true;
    }
    if (swappedImageUrl) {
      options.faceSwapUrl = swappedImageUrl;
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
    if (disablePromptExtend) {
      options.promptExtend = false;
    }

    log.debug('Queueing operation.', {
      operation,
      requestId,
      userId,
      promptLength: promptWithMotion.length,
      promptLengthBeforeMotion,
      promptLengthAfterMotion,
      motionGuidanceAppended,
      promptWasStripped,
      aspectRatio,
      model,
      videoCost,
      keyframeCost,
      faceSwapCost,
      totalCost: videoCost + keyframeCost + faceSwapCost,
      usedKeyframe: Boolean(generatedKeyframeUrl),
      faceSwapApplied: Boolean(swappedImageUrl),
      hasCameraMotion: Boolean(motionContext.cameraMotionId),
      cameraMotionId: motionContext.cameraMotionId,
      hasSubjectMotion: Boolean(motionContext.subjectMotion),
      subjectMotionLength: motionContext.subjectMotion?.length ?? 0,
      promptExtend: options.promptExtend ?? null,
    });

    try {
      const job = await videoJobStore.createJob({
        userId,
        request: {
          prompt: promptWithMotion,
          options,
        },
        creditsReserved: videoCost,
      });

      log.info('Operation queued.', {
        operation,
        requestId,
        userId,
        jobId: job.id,
        videoCost,
        keyframeCost,
        faceSwapCost,
        keyframeUrl: generatedKeyframeUrl,
        faceSwapUrl: swappedImageUrl,
        hasCameraMotion: Boolean(motionContext.cameraMotionId),
        cameraMotionId: motionContext.cameraMotionId,
        hasSubjectMotion: Boolean(motionContext.subjectMotion),
        subjectMotionLength: motionContext.subjectMotion?.length ?? 0,
        promptLengthBeforeMotion,
        promptLengthAfterMotion,
        motionGuidanceAppended,
      });

      scheduleInlineVideoPreviewProcessing({
        jobId: job.id,
        requestId,
        videoJobStore,
        videoGenerationService,
        userCreditService,
      });

      const responsePayload = {
        jobId: job.id,
        status: job.status,
        creditsReserved: videoCost,
        creditsDeducted: videoCost + keyframeCost + faceSwapCost,
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
      await userCreditService.refundCredits(userId, videoCost);
      if (keyframeCost > 0) {
        await userCreditService.refundCredits(userId, keyframeCost);
      }
      if (faceSwapCost > 0) {
        await userCreditService.refundCredits(userId, faceSwapCost);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);

      log.error('Operation failed.', errorInstance, {
        operation,
        requestId,
        userId,
        refundAmount: videoCost + keyframeCost + faceSwapCost,
        statusCode,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Video generation failed',
        message: errorMessage,
      });
    }
  };
