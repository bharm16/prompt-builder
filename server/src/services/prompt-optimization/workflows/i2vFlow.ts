import type { OptimizationResponse } from '../types';
import type { I2VFlowArgs } from './types';

const isCameraMotionLocked = (generationParams?: Record<string, unknown> | null): boolean => {
  if (!generationParams) {
    return false;
  }
  const cameraMotionId =
    typeof generationParams.camera_motion_id === 'string'
      ? generationParams.camera_motion_id
      : typeof generationParams.cameraMotionId === 'string'
        ? generationParams.cameraMotionId
        : '';
  return cameraMotionId.trim().length > 0;
};

export const runI2vFlow = async ({
  params,
  imageObservation,
  i2vStrategy,
}: I2VFlowArgs): Promise<OptimizationResponse> => {
  const { prompt, startImage, constraintMode, sourcePrompt, generationParams, skipCache } = params;
  const observationResult = await imageObservation.observe({
    image: startImage,
    skipCache: skipCache === true,
    ...(sourcePrompt ? { sourcePrompt } : {}),
  });

  const observation = observationResult.observation;
  if (!observation) {
    throw new Error('Image observation failed');
  }

  const cameraMotionLocked = isCameraMotionLocked(
    (generationParams as Record<string, unknown> | null | undefined) ?? null
  );
  const mode = constraintMode || 'strict';
  const result = await i2vStrategy.optimize({
    prompt,
    observation,
    mode,
    cameraMotionLocked,
  });

  return {
    prompt: result.prompt,
    inputMode: 'i2v',
    i2v: result,
    metadata: {
      observationCached: observationResult.cached,
      observationUsedFastPath: observationResult.usedFastPath,
    },
  };
};
