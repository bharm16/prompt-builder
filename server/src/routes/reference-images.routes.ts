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

function requireRouteParam(req: Request, res: Response, key: string): string | null {
  const value = req.params[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    res.status(400).json({ error: `Invalid ${key}` });
    return null;
  }
  return value;
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
      const listOptions = limit !== undefined ? { limit } : {};

      const images = await referenceImageService.listImages(userId, listOptions);
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
      const createInput = {
        ...(label !== undefined ? { label } : {}),
        ...(source !== undefined ? { source } : {}),
        originalName: file.originalname,
      };

      try {
        const buffer = await readUploadBuffer(file);
        const image = await referenceImageService.createFromBuffer(userId, buffer, createInput);

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

      const normalizedLabel = normalizeOptionalString(label);
      const normalizedSource = normalizeOptionalString(source);
      const createInput = {
        ...(normalizedLabel !== undefined ? { label: normalizedLabel } : {}),
        ...(normalizedSource !== undefined ? { source: normalizedSource } : {}),
      };
      const image = await referenceImageService.createFromUrl(userId, sourceUrl.trim(), createInput);

      res.status(201).json(image);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = requireUserId(req as RequestWithUser, res);
      if (!userId) return;

      const imageId = requireRouteParam(req, res, 'id');
      if (!imageId) return;
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
