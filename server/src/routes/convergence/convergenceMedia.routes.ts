/**
 * Convergence Media Proxy Routes
 *
 * Provides a proxy for signed GCS URLs so Three.js textures can load with CORS
 * from the app origin (avoids browser CORS blocks on storage.googleapis.com).
 */

import express, { type Request, type Response, type Router } from 'express';
import { cleanupUploadFile, createDiskUpload, readUploadBuffer } from '@utils/upload';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { logger } from '@infrastructure/Logger';
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { asyncHandler } from '@middleware/asyncHandler';
import type { GCSStorageService } from '@services/convergence/storage';

const STORAGE_HOST = 'storage.googleapis.com';
const STORAGE_HOST_SUFFIX = '.storage.googleapis.com';

const upload = createDiskUpload({
  fileSizeBytes: 10 * 1024 * 1024,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files allowed'));
  },
});

interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

const stripLeadingSlash = (value: string): string => value.replace(/^\/+/, '');

const extractObjectPath = (url: URL, bucketName: string): string | null => {
  const host = url.hostname;
  const path = stripLeadingSlash(url.pathname);

  if (!path) {
    return null;
  }

  if (host === STORAGE_HOST) {
    const [bucket, ...rest] = path.split('/');
    if (bucket !== bucketName) {
      return null;
    }
    return rest.join('/') || null;
  }

  if (host.endsWith(STORAGE_HOST_SUFFIX)) {
    const bucketFromHost = host.slice(0, -STORAGE_HOST_SUFFIX.length);
    if (bucketFromHost !== bucketName) {
      return null;
    }
    return path;
  }

  return null;
};

const sanitizeFilename = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_');

export function createConvergenceMediaRoutes(getStorageService: () => GCSStorageService): Router {
  const router = express.Router();

  router.post(
    '/upload-image',
    apiAuthMiddleware,
    upload.single('image'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.uid;
      const file = req.file;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'No image provided',
        });
      }

      const safeName = sanitizeFilename(file.originalname || 'upload.png');
      const destination = `convergence/${userId}/uploads/${Date.now()}-${safeName}`;
      const storageService = getStorageService();

      let url: string;
      try {
        const buffer = await readUploadBuffer(file);
        url = await storageService.uploadBuffer(
          buffer,
          destination,
          file.mimetype || 'image/png'
        );
      } finally {
        await cleanupUploadFile(file);
      }

      logger.info('Convergence image uploaded', {
        userId,
        destination,
        sizeBytes: file.size,
        contentType: file.mimetype,
      });

      return res.status(200).json({
        success: true,
        url,
      });
    })
  );

  router.get(
    '/proxy',
    asyncHandler(async (req: Request, res: Response) => {
      const urlParam = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const storageService = getStorageService();
      const bucketName = storageService.getBucketName();

      if (!urlParam) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Missing required query parameter: url',
        });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlParam);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Invalid url parameter',
        });
      }

      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Only https URLs are supported',
        });
      }

      const objectPath = extractObjectPath(parsedUrl, bucketName);
      if (!objectPath) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'URL host or bucket is not allowed',
        });
      }

      logger.debug('Proxying convergence media asset', {
        bucketName,
        objectPath,
        host: parsedUrl.hostname,
      });

      let upstreamUrl = parsedUrl.toString();
      try {
        const refreshedUrl = await storageService.refreshSignedUrl(upstreamUrl);
        if (refreshedUrl) {
          upstreamUrl = refreshedUrl;
        }
      } catch (error) {
        logger.warn('Failed to refresh convergence media proxy URL; using original', {
          bucketName,
          objectPath,
          host: parsedUrl.hostname,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const upstream = await fetch(upstreamUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        redirect: 'follow',
      });

      res.status(upstream.status);

      const contentType = upstream.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const cacheControl = upstream.headers.get('cache-control');
      if (cacheControl) {
        res.setHeader('Cache-Control', cacheControl);
      }

      if (req.method === 'HEAD' || !upstream.body) {
        return res.end();
      }

      const stream = Readable.fromWeb(upstream.body as unknown as NodeReadableStream<Uint8Array>);
      stream.on('error', (error) => {
        logger.warn('Convergence media proxy stream error', {
          error: error instanceof Error ? error.message : String(error),
          bucketName,
          objectPath,
        });
        if (!res.headersSent) {
          res.status(502);
        }
        res.end();
      });

      stream.pipe(res);
      return res;
    })
  );

  return router;
}

export default createConvergenceMediaRoutes;
