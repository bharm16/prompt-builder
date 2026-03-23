/**
 * Media Proxy Route
 *
 * Proxies signed GCS URLs through the app origin to avoid browser ORB
 * (Opaque Response Blocking) failures. When COEP is set to 'credentialless',
 * cross-origin image/video loads from GCS can be blocked if the GCS bucket
 * lacks CORS headers. This proxy eliminates the cross-origin fetch entirely.
 *
 * Adapted from the convergence media proxy pattern.
 */

import express, { type Request, type Response, type Router } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { asyncHandler } from '@middleware/asyncHandler';
import { logger } from '@infrastructure/Logger';

const log = logger.child({ module: 'mediaProxy' });

const STORAGE_HOST = 'storage.googleapis.com';
const STORAGE_HOST_SUFFIX = '.storage.googleapis.com';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const extractObjectPath = (url: URL, bucketName: string): string | null => {
  const host = url.hostname;
  const path = url.pathname.replace(/^\/+/, '');

  if (!path) return null;

  if (host === STORAGE_HOST) {
    const [bucket, ...rest] = path.split('/');
    if (bucket !== bucketName) return null;
    return rest.join('/') || null;
  }

  if (host.endsWith(STORAGE_HOST_SUFFIX)) {
    const bucketFromHost = host.slice(0, -STORAGE_HOST_SUFFIX.length);
    if (bucketFromHost !== bucketName) return null;
    return path;
  }

  return null;
};

export function createMediaProxyRoutes(bucketName: string): Router {
  const router = express.Router();

  router.get(
    '/proxy',
    asyncHandler(async (req: Request, res: Response) => {
      const urlParam = typeof req.query.url === 'string' ? req.query.url.trim() : '';

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

      log.debug('Proxying media asset', { bucketName, objectPath });

      const upstream = await fetch(parsedUrl.toString(), {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        redirect: 'follow',
      });

      if (!upstream.ok) {
        log.warn('Upstream media fetch failed', {
          status: upstream.status,
          objectPath,
        });
        return res.status(upstream.status).json({
          success: false,
          error: 'UPSTREAM_ERROR',
          message: `Upstream returned ${upstream.status}`,
        });
      }

      const contentType = upstream.headers.get('content-type');
      if (contentType && !ALLOWED_CONTENT_TYPES.has(contentType.split(';')[0]!.trim())) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Content type not allowed',
        });
      }

      res.status(200);

      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const cacheControl = upstream.headers.get('cache-control');
      res.setHeader('Cache-Control', cacheControl || 'public, max-age=300, immutable');

      if (req.method === 'HEAD' || !upstream.body) {
        return res.end();
      }

      const stream = Readable.fromWeb(upstream.body as unknown as NodeReadableStream<Uint8Array>);
      stream.on('error', (error) => {
        log.warn('Media proxy stream error', {
          error: error instanceof Error ? error.message : String(error),
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
