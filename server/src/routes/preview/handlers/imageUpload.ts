import type { Request, Response } from 'express';
import fs from 'fs';
import { logger } from '@infrastructure/Logger';
import { getStorageService } from '@services/storage/StorageService';
import { cleanupUploadFile, readUploadBuffer } from '@utils/upload';
import { getAuthenticatedUserId } from '../auth';

const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export const createImageUploadHandler = () =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to upload images.',
      });
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
        message: 'Upload must include a file field.',
      });
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type',
        message: 'Supported types: PNG, JPEG, WebP.',
      });
    }

    const metadata = parseMetadata((req as Request & { body?: { metadata?: unknown } }).body?.metadata);
    const source = normalizeOptionalString((req as Request & { body?: { source?: unknown } }).body?.source);
    const label = normalizeOptionalString((req as Request & { body?: { label?: unknown } }).body?.label);

    const storage = getStorageService();

    try {
      const uploadMetadata = {
        ...metadata,
        ...(source ? { source } : {}),
        ...(label ? { label } : {}),
        originalName: file.originalname,
      };

      const result =
        file.path && typeof storage.uploadStream === 'function'
          ? await storage.uploadStream(
              fs.createReadStream(file.path),
              file.size,
              userId,
              'preview-image',
              file.mimetype,
              uploadMetadata
            )
          : await storage.uploadBuffer(
              userId,
              'preview-image',
              await readUploadBuffer(file),
              file.mimetype,
              uploadMetadata
            );

      return res.status(201).json({
        success: true,
        data: {
          imageUrl: result.viewUrl,
          storagePath: result.storagePath,
          viewUrl: result.viewUrl,
          viewUrlExpiresAt: result.expiresAt,
          sizeBytes: result.sizeBytes,
          contentType: result.contentType,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isClientError =
        errorMessage.includes('Invalid content type') || errorMessage.includes('File too large');

      if (!isClientError) {
        logger.error('Image upload failed', error instanceof Error ? error : new Error(errorMessage));
      }

      return res.status(isClientError ? 400 : 500).json({
        success: false,
        error: 'Image upload failed',
        message: errorMessage,
      });
    } finally {
      await cleanupUploadFile(file);
    }
  };
