/**
 * Convergence Media Proxy Routes
 *
 * Provides a proxy for signed GCS URLs so Three.js textures can load with CORS
 * from the app origin (avoids browser CORS blocks on storage.googleapis.com).
 */

import express, { type Request, type Response, type Router } from 'express';
import { Readable } from 'node:stream';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';

const STORAGE_HOST = 'storage.googleapis.com';
const STORAGE_HOST_SUFFIX = '.storage.googleapis.com';

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

export function createConvergenceMediaRoutes(): Router {
  const router = express.Router();

  router.get(
    '/proxy',
    asyncHandler(async (req: Request, res: Response) => {
      const urlParam = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const bucketName = process.env.GCS_BUCKET_NAME?.trim();

      if (!bucketName) {
        return res.status(500).json({
          success: false,
          error: 'SERVER_CONFIGURATION_ERROR',
          message: 'GCS_BUCKET_NAME is not configured',
        });
      }

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

      const upstream = await fetch(parsedUrl.toString(), {
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

      const stream = Readable.fromWeb(upstream.body as ReadableStream<Uint8Array>);
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
