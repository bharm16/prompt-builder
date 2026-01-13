import type { Request } from 'express';
import type { VideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';

const LOCAL_CONTENT_PREFIX = '/api/preview/video/content';

export function extractVideoContentToken(req: Request): string | null {
  const token = req.query?.token;
  if (typeof token === 'string' && token.trim().length > 0) {
    return token.trim();
  }
  return null;
}

function isLocalContentUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    try {
      const parsed = new URL(rawUrl);
      return parsed.pathname.startsWith(LOCAL_CONTENT_PREFIX);
    } catch {
      return false;
    }
  }

  return rawUrl.startsWith(LOCAL_CONTENT_PREFIX);
}

export function buildVideoContentUrl(
  accessService: VideoContentAccessService | null | undefined,
  rawUrl: string | null | undefined,
  assetId: string,
  userId?: string | null
): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  if (!accessService) {
    return isLocalContentUrl(rawUrl) ? undefined : rawUrl;
  }

  return accessService.buildAccessUrl(rawUrl, assetId, userId || undefined);
}
