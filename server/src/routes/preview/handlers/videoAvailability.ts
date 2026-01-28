import type { Request, Response } from 'express';
import type { PreviewRoutesServices } from '@routes/types';
import { emptyAvailability, getCapabilityModelIds } from '../availability';

type VideoAvailabilityServices = Pick<PreviewRoutesServices, 'videoGenerationService'>;

export const createVideoAvailabilityHandler = ({
  videoGenerationService,
}: VideoAvailabilityServices) =>
  async (_req: Request, res: Response): Promise<Response> => {
    if (!videoGenerationService) {
      return res.json(emptyAvailability());
    }

    const report = videoGenerationService.getAvailabilityReport(getCapabilityModelIds());
    return res.json(report);
  };
