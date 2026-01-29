import type { Request, Response } from 'express';
import type { PreviewRoutesServices } from '@routes/types';
import { emptyAvailability } from '../availability';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoModelId } from '@services/video-generation/types';
import { resolveModelId as resolveCapabilityModelId } from '@services/capabilities/modelProviders';

type VideoAvailabilityServices = Pick<PreviewRoutesServices, 'videoGenerationService'>;

export const createVideoAvailabilityHandler = ({
  videoGenerationService,
}: VideoAvailabilityServices) =>
  async (_req: Request, res: Response): Promise<Response> => {
    if (!videoGenerationService) {
      const data = emptyAvailability();
      return res.json({
        success: false,
        error: 'Video generation service is not available',
        data,
        ...data,
      });
    }

    const canonicalModelIds = Object.values(VIDEO_MODELS) as VideoModelId[];
    const snapshot = videoGenerationService.getAvailabilitySnapshot(canonicalModelIds);
    const availableCapabilityModels = Array.from(
      new Set(
        snapshot.availableModelIds
          .map((modelId) => resolveCapabilityModelId(modelId))
          .filter((modelId): modelId is string => typeof modelId === 'string' && modelId.length > 0)
      )
    );
    const data = {
      models: snapshot.models,
      availableModels: snapshot.availableModelIds,
      availableCapabilityModels,
    };
    return res.json({
      success: true,
      data,
      ...data,
    });
  };
