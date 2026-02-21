import express, { type Request, type Router } from 'express';
import { isIP } from 'node:net';
import { asyncHandler } from '@middleware/asyncHandler';
import { STORAGE_TYPES, type StorageType } from '@services/storage/config/storageConfig';

type RequestWithUser = Request & { user?: { uid?: string } };

const STORAGE_TYPE_SET = new Set<StorageType>(Object.values(STORAGE_TYPES));

export interface StorageRoutesService {
  getUploadUrl: (
    userId: string,
    type: StorageType,
    contentType: string,
    metadata?: Record<string, unknown>
  ) => Promise<unknown>;
  saveFromUrl: (
    userId: string,
    sourceUrl: string,
    type: StorageType,
    metadata?: Record<string, unknown>
  ) => Promise<unknown>;
  confirmUpload: (userId: string, storagePath: string) => Promise<unknown>;
  getViewUrl: (userId: string, path: string) => Promise<unknown>;
  getDownloadUrl: (userId: string, path: string, filename?: string) => Promise<unknown>;
  listFiles: (
    userId: string,
    options: { limit: number; type?: StorageType; pageToken?: string }
  ) => Promise<unknown>;
  getStorageUsage: (userId: string) => Promise<unknown>;
  deleteFile: (userId: string, path: string) => Promise<unknown>;
  deleteFiles: (userId: string, paths: unknown[]) => Promise<unknown>;
}

function resolveUserId(req: RequestWithUser): string | null {
  return req.user?.uid ?? null;
}

function rejectAnonymous(userId: string | null): string | null {
  if (!userId || userId === 'anonymous' || isIP(userId) !== 0) {
    return null;
  }
  return userId;
}

function normalizeStorageType(value: unknown): StorageType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!STORAGE_TYPE_SET.has(normalized as StorageType)) return null;
  return normalized as StorageType;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function createStorageRoutes(storageService: StorageRoutesService): Router {
  const router = express.Router();

  router.post(
    '/upload-url',
    asyncHandler(async (req, res) => {
      const { type, contentType, metadata } = req.body || {};
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));
      const normalizedType = normalizeStorageType(type);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to upload media.',
        });
      }

      if (
        !normalizedType ||
        typeof contentType !== 'string' ||
        contentType.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: type, contentType',
        });
      }
      const normalizedContentType = contentType.trim();
      const result = await storageService.getUploadUrl(
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
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));
      const normalizedType = normalizeStorageType(type);

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
        !normalizedType
      ) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sourceUrl, type',
        });
      }
      const normalizedSourceUrl = sourceUrl.trim();
      const result = await storageService.saveFromUrl(
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
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

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
      const result = await storageService.confirmUpload(userId, storagePath.trim());

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/view-url',
    asyncHandler(async (req, res) => {
      const path = typeof req.query.path === 'string' ? req.query.path.trim() : null;
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

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
      const result = await storageService.getViewUrl(userId, path);

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/download-url',
    asyncHandler(async (req, res) => {
      const path = typeof req.query.path === 'string' ? req.query.path.trim() : null;
      const filename = typeof req.query.filename === 'string' ? req.query.filename.trim() : null;
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

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
      const result = await storageService.getDownloadUrl(userId, path, filename || undefined);

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/list',
    asyncHandler(async (req, res) => {
      const type = normalizeStorageType(req.query.type);
      const limitValue = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to list media.',
        });
      }

      if (req.query.type !== undefined && !type) {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Expected one of: ${Object.values(STORAGE_TYPES).join(', ')}`,
        });
      }
      const listOptions = {
        limit: Number.isFinite(limitValue) ? limitValue : 50,
        ...(type ? { type } : {}),
        ...(cursor ? { pageToken: cursor } : {}),
      };
      const result = await storageService.listFiles(userId, listOptions);

      return res.json({ success: true, data: result });
    })
  );

  router.get(
    '/usage',
    asyncHandler(async (req, res) => {
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to view storage usage.',
        });
      }
      const result = await storageService.getStorageUsage(userId);

      return res.json({ success: true, data: result });
    })
  );

  router.delete(
    '/:path(*)',
    asyncHandler(async (req, res) => {
      const { path } = req.params as { path?: string };
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

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
      const result = await storageService.deleteFile(userId, path.trim());

      return res.json({ success: true, data: result });
    })
  );

  router.post(
    '/delete-batch',
    asyncHandler(async (req, res) => {
      const { paths } = req.body || {};
      const userId = rejectAnonymous(resolveUserId(req as RequestWithUser));

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
      const result = await storageService.deleteFiles(userId, paths);

      return res.json({ success: true, data: result });
    })
  );

  return router;
}

export default createStorageRoutes;
