import express, { type Router, type Request, type Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ImageObservationService } from '@services/image-observation';

export function createImageObservationRoutes(
  imageObservationService: ImageObservationService
): Router {
  const router = express.Router();

  router.post(
    '/image/observe',
    asyncHandler(async (req: Request, res: Response) => {
      const { image, skipCache } = (req.body || {}) as {
        image?: unknown;
        skipCache?: unknown;
      };

      if (typeof image !== 'string' || image.trim().length === 0) {
        return res.status(400).json({ error: 'image must be a non-empty string' });
      }

      const result = await imageObservationService.observe({
        image,
        skipCache: skipCache === true,
      });

      return res.json(result);
    })
  );

  return router;
}
