import express, { type Request, type Router } from 'express';
import { isIP } from 'node:net';
import { asyncHandler } from '@middleware/asyncHandler';
import { getStorageService } from '@services/storage/StorageService';
import { getAuthenticatedUserId } from '@routes/preview/auth';

interface RequestWithUser extends Request {
  user?: { uid?: string };
}

async function resolveUserId(req: RequestWithUser): Promise<string | null> {
  if (req.user?.uid) {
    return req.user.uid;
  }
  return await getAuthenticatedUserId(req);
}

function rejectAnonymous(userId: string | null): string | null {
  if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
    return null;
  }
  return userId;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function createStorageRoutes(): Router {
  const router = express.Router();

  router.post(
    '/upload-url',
    asyncHandler(async (req, res) => {
      const { type, contentType, metadata } = req.body || {};
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to upload media.',
        });
      }

      if (
        typeof type !== 'string' ||
        type.trim().length === 0 ||
        typeof contentType !== 'string' ||
        contentType.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: type, contentType',
        });
      }

      const storage = getStorageService();
      const normalizedType = type.trim();
      const normalizedContentType = contentType.trim();
      const result = await storage.getUploadUrl(
        userId,
        normalizedType,
        normalizedContentType,
        normalizeMetadata(metadata)
      );

      return res.json({ success: true, data: result });
    })
  );

  router.post(
    '/save-from-url',
    asyncHandler(async (req, res) => {
      const { sourceUrl, type, metadata } = req.body || {};
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to save media.',
        });
      }

      if (
        typeof sourceUrl !== 'string' ||
        sourceUrl.trim().length === 0 ||
        typeof type !== 'string' ||
        type.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sourceUrl, type',
        });
      }

      const storage = getStorageService();
      const normalizedType = type.trim();
      const normalizedSourceUrl = sourceUrl.trim();
      const result = await storage.saveFromUrl(
        userId,
        normalizedSourceUrl,
        normalizedType,
        normalizeMetadata(metadata)
      );

      return res.json({ success: true, data: result });
    })
  );

  router.post(
    '/confirm-upload',
    asyncHandler(async (req, res) => {
      const { storagePath } = req.body || {};
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to confirm uploads.',
        });
      }

      if (typeof storagePath !== 'string' || storagePath.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: storagePath',
        });
      }

      const storage = getStorageService();
      const result = await storage.confirmUpload(userId, storagePath.trim());

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/view-url',
    asyncHandler(async (req, res) => {
      const path = typeof req.query.path === 'string' ? req.query.path.trim() : null;
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to view media.',
        });
      }

      if (!path) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameter: path',
        });
      }

      const storage = getStorageService();
      const result = await storage.getViewUrl(userId, path);

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/download-url',
    asyncHandler(async (req, res) => {
      const path = typeof req.query.path === 'string' ? req.query.path.trim() : null;
      const filename = typeof req.query.filename === 'string' ? req.query.filename.trim() : null;
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to download media.',
        });
      }

      if (!path) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameter: path',
        });
      }

      const storage = getStorageService();
      const result = await storage.getDownloadUrl(userId, path, filename || undefined);

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/list',
    asyncHandler(async (req, res) => {
      const type = typeof req.query.type === 'string' ? req.query.type.trim() : undefined;
      const limitValue = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to list media.',
        });
      }

      const storage = getStorageService();
      const result = await storage.listFiles(userId, {
        type,
        limit: Number.isFinite(limitValue) ? limitValue : 50,
        pageToken: cursor,
      });

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/usage',
    asyncHandler(async (req, res) => {
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to view storage usage.',
        });
      }

      const storage = getStorageService();
      const result = await storage.getStorageUsage(userId);

      return res.json({ success: true, data: result });
    })
  );

  router.delete(
    '/:path(*)',
    asyncHandler(async (req, res) => {
      const { path } = req.params as { path?: string };
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to delete media.',
        });
      }

      if (!path) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: path',
        });
      }

      const storage = getStorageService();
      const result = await storage.deleteFile(userId, path.trim());

      return res.json({ success: true, data: result });
    })
  );

  router.post(
    '/delete-batch',
    asyncHandler(async (req, res) => {
      const { paths } = req.body || {};
      const userId = rejectAnonymous(await resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to delete media.',
        });
      }

      if (!paths || !Array.isArray(paths)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: paths (array)',
        });
      }

      const storage = getStorageService();
      const result = await storage.deleteFiles(userId, paths);

      return res.json({ success: true, data: result });
    })
  );

  return router;
}

export default createStorageRoutes;
