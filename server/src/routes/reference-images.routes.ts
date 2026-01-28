import express, { type Request, type Response, type Router } from 'express';
import { cleanupUploadFile, createDiskUpload, readUploadBuffer } from '@utils/upload';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ReferenceImageService } from '@services/reference-images/ReferenceImageService';

const upload = createDiskUpload({
  fileSizeBytes: 10 * 1024 * 1024,
});

type RequestWithUser = Request & { user?: { uid?: string } };

function requireUserId(req: RequestWithUser, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function createReferenceImagesRoutes(
  referenceImageService: ReferenceImageService
): Router {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const limitValue = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
      const limit = Number.isFinite(limitValue) ? limitValue : undefined;

      const images = await referenceImageService.listImages(userId, { limit });
      res.json({ images });
    })
  );

  router.post(
    '/',
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const label = normalizeOptionalString((req as Request & { body?: { label?: unknown } }).body?.label);
      const source = normalizeOptionalString((req as Request & { body?: { source?: unknown } }).body?.source);

      try {
        const buffer = await readUploadBuffer(file);
        const image = await referenceImageService.createFromBuffer(userId, buffer, {
          label,
          source,
          originalName: file.originalname,
        });

        res.status(201).json(image);
      } finally {
        await cleanupUploadFile(file);
      }
    })
  );

  router.post(
    '/from-url',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const { sourceUrl, label, source } = (req.body || {}) as {
        sourceUrl?: unknown;
        label?: unknown;
        source?: unknown;
      };

      if (!sourceUrl || typeof sourceUrl !== 'string') {
        res.status(400).json({ error: 'sourceUrl is required' });
        return;
      }

      const image = await referenceImageService.createFromUrl(userId, sourceUrl.trim(), {
        label: normalizeOptionalString(label),
        source: normalizeOptionalString(source),
      });

      res.status(201).json(image);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const imageId = req.params.id;
      const deleted = await referenceImageService.deleteImage(userId, imageId);
      if (!deleted) {
        res.status(404).json({ error: 'Reference image not found' });
        return;
      }

      res.status(204).send();
    })
  );

  return router;
}

export default createReferenceImagesRoutes;
