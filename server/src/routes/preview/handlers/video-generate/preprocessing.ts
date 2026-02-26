import { GENERATION_ERROR_CODES } from '@routes/generationErrorCodes';
import { FACE_SWAP_CREDIT_COST, KEYFRAME_CREDIT_COST } from './constants';
import type { PreprocessingArgs, PreprocessingResult } from './types';

export const runVideoPreprocessing = async ({
  requestId,
  userId,
  startImage,
  characterAssetId,
  autoKeyframe,
  faceSwapAlreadyApplied,
  aspectRatio,
  cleanedPrompt,
  services,
  refunds,
  log,
}: PreprocessingArgs): Promise<PreprocessingResult> => {
  const { userCreditService, keyframeService, faceSwapService, assetService } = services;

  let nextCharacterAssetId = characterAssetId;
  let resolvedStartImage = startImage;
  let generatedKeyframeUrl: string | null = null;
  let swappedImageUrl: string | null = null;

  if (startImage && nextCharacterAssetId && faceSwapAlreadyApplied) {
    resolvedStartImage = startImage;
    swappedImageUrl = startImage;
    log.info('Using pre-applied face swap image', {
      requestId,
      characterAssetId: nextCharacterAssetId,
      hasStartImage: true,
    });
  } else if (startImage && nextCharacterAssetId) {
    if (!faceSwapService || !assetService) {
      log.warn('Face-swap service unavailable', {
        requestId,
        characterAssetId: nextCharacterAssetId,
      });
      return {
        resolvedStartImage,
        generatedKeyframeUrl,
        swappedImageUrl,
        characterAssetId: nextCharacterAssetId,
        error: {
          status: 400,
          payload: {
            error: 'Face-swap not available',
            code: GENERATION_ERROR_CODES.INVALID_REQUEST,
            details:
              'Character + composition reference requires face-swap service. Use startImage alone for direct i2v, or characterAssetId alone for auto-keyframe.',
          },
        },
      };
    }

    const hasFaceSwapCredits = await userCreditService.reserveCredits(userId, FACE_SWAP_CREDIT_COST);
    if (!hasFaceSwapCredits) {
      return {
        resolvedStartImage,
        generatedKeyframeUrl,
        swappedImageUrl,
        characterAssetId: nextCharacterAssetId,
        error: {
          status: 402,
          payload: {
            error: 'Insufficient credits',
            code: GENERATION_ERROR_CODES.INSUFFICIENT_CREDITS,
            details: `Character-composition face-swap requires ${FACE_SWAP_CREDIT_COST} credits plus video credits.`,
          },
        },
      };
    }
    refunds.setFaceSwapCost(FACE_SWAP_CREDIT_COST);

    try {
      const characterData = await assetService.getAssetForGeneration(userId, nextCharacterAssetId);
      if (!characterData.primaryImageUrl) {
        await refunds.refundFaceSwapCredits('video face-swap missing character reference image');
        return {
          resolvedStartImage,
          generatedKeyframeUrl,
          swappedImageUrl,
          characterAssetId: nextCharacterAssetId,
          error: {
            status: 400,
            payload: {
              error: 'Character has no reference image',
              code: GENERATION_ERROR_CODES.INVALID_REQUEST,
              details: 'The character asset must have a reference image for face-swap.',
            },
          },
        };
      }

      log.info('Performing face-swap preprocessing', {
        requestId,
        characterAssetId: nextCharacterAssetId,
        hasStartImage: true,
      });

      const swapResult = await faceSwapService.swap({
        characterPrimaryImageUrl: characterData.primaryImageUrl,
        targetCompositionUrl: startImage,
        ...(aspectRatio ? { aspectRatio } : {}),
      });

      resolvedStartImage = swapResult.swappedImageUrl;
      swappedImageUrl = swapResult.swappedImageUrl;

      log.info('Face-swap completed', {
        requestId,
        characterAssetId: nextCharacterAssetId,
        durationMs: swapResult.durationMs,
      });
    } catch (error) {
      await refunds.refundFaceSwapCredits('video face-swap preprocessing failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Face-swap failed', error instanceof Error ? error : new Error(errorMessage), {
        requestId,
        characterAssetId: nextCharacterAssetId,
      });
      return {
        resolvedStartImage,
        generatedKeyframeUrl,
        swappedImageUrl,
        characterAssetId: nextCharacterAssetId,
        error: {
          status: 500,
          payload: {
            error: 'Face-swap failed',
            code: GENERATION_ERROR_CODES.GENERATION_FAILED,
            details: `Failed to composite character face: ${errorMessage}`,
          },
        },
      };
    }
  } else if (nextCharacterAssetId && autoKeyframe && !startImage) {
    if (!keyframeService) {
      log.warn('Keyframe service unavailable, falling back to direct generation', {
        requestId,
        characterAssetId: nextCharacterAssetId,
      });
    } else if (!assetService) {
      log.warn('Asset service unavailable, falling back to direct generation', {
        requestId,
        characterAssetId: nextCharacterAssetId,
      });
    } else {
      try {
        log.info('Generating PuLID keyframe for character', {
          requestId,
          characterAssetId: nextCharacterAssetId,
          userId,
        });

        const hasKeyframeCredits = await userCreditService.reserveCredits(userId, KEYFRAME_CREDIT_COST);
        if (!hasKeyframeCredits) {
          return {
            resolvedStartImage,
            generatedKeyframeUrl,
            swappedImageUrl,
            characterAssetId: nextCharacterAssetId,
            error: {
              status: 402,
              payload: {
                error: 'Insufficient credits',
                code: GENERATION_ERROR_CODES.INSUFFICIENT_CREDITS,
                details: `Character-consistent generation requires ${KEYFRAME_CREDIT_COST} credits for keyframe plus video credits.`,
              },
            },
          };
        }
        refunds.setKeyframeCost(KEYFRAME_CREDIT_COST);

        const characterData = await assetService.getAssetForGeneration(userId, nextCharacterAssetId);

        if (!characterData.primaryImageUrl) {
          await refunds.refundKeyframeCredits('video keyframe missing character reference image');
          return {
            resolvedStartImage,
            generatedKeyframeUrl,
            swappedImageUrl,
            characterAssetId: nextCharacterAssetId,
            error: {
              status: 400,
              payload: {
                error: 'Character has no reference image',
                code: GENERATION_ERROR_CODES.INVALID_REQUEST,
                details:
                  'The character asset must have at least one reference image for face-consistent generation.',
              },
            },
          };
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
          characterAssetId: nextCharacterAssetId,
          keyframeUrl: generatedKeyframeUrl,
          faceStrength: keyframeResult.faceStrength,
        });
      } catch (error) {
        if (refunds.ledger.keyframeCost > 0) {
          await refunds.refundKeyframeCredits('video keyframe preprocessing failed');
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(
          'Keyframe generation failed',
          error instanceof Error ? error : new Error(errorMessage),
          {
            requestId,
            characterAssetId: nextCharacterAssetId,
          }
        );

        return {
          resolvedStartImage,
          generatedKeyframeUrl,
          swappedImageUrl,
          characterAssetId: nextCharacterAssetId,
          error: {
            status: 500,
            payload: {
              error: 'Keyframe generation failed',
              code: GENERATION_ERROR_CODES.GENERATION_FAILED,
              details: `Failed to generate character-consistent keyframe: ${errorMessage}`,
            },
          },
        };
      }
    }
  }

  return {
    resolvedStartImage,
    generatedKeyframeUrl,
    swappedImageUrl,
    ...(nextCharacterAssetId ? { characterAssetId: nextCharacterAssetId } : {}),
  };
};
