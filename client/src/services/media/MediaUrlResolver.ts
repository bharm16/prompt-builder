import { storageApi } from '@/api/storageApi';
import {
  getImageAssetViewUrl,
  getVideoAssetViewUrl,
} from '@/features/preview/api/previewApi';
import {
  extractStorageObjectPath,
  extractVideoContentAssetId,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from '@/utils/storageUrl';
import { logger } from '@/services/LoggingService';

export type MediaKind = 'image' | 'video';

export interface MediaUrlRequest {
  kind: MediaKind;
  url?: string | null;
  storagePath?: string | null;
  assetId?: string | null;
  preferFresh?: boolean;
}

export interface MediaUrlResult {
  url: string | null;
  expiresAt?: string | null;
  storagePath?: string | null;
  assetId?: string | null;
  source: 'storage' | 'preview' | 'content' | 'raw' | 'unknown';
}

const log = logger.child('MediaUrlResolver');
const inflight = new Map<string, Promise<MediaUrlResult>>();
const cache = new Map<string, { result: MediaUrlResult; expiresAtMs: number | null; cachedAt: number }>();

const CACHE_TTL_MS = 30_000;
const EXPIRY_SAFETY_WINDOW_MS = 2 * 60 * 1000;
const PREVIEW_ROUTE_PREFIX = '/api/preview/';
const VIDEO_CONTENT_ROUTE_PREFIX = '/api/preview/video/content/';

const parseCandidateUrl = (rawUrl: string): URL | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    if (typeof window === 'undefined') return null;
    try {
      return new URL(trimmed, window.location.origin);
    } catch {
      return null;
    }
  }
};

const isBlockedRawPreviewUrl = (rawUrl: string | null | undefined): boolean => {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) return false;
  const parsed = parseCandidateUrl(rawUrl);
  if (!parsed) return false;
  const path = parsed.pathname;
  if (!path.startsWith(PREVIEW_ROUTE_PREFIX)) return false;
  if (path.startsWith(VIDEO_CONTENT_ROUTE_PREFIX) && parsed.searchParams.has('token')) {
    return false;
  }
  return true;
};

const pickSafeFallbackUrl = (fallbackUrl: string | null): string | null => {
  if (!fallbackUrl) return null;
  return isBlockedRawPreviewUrl(fallbackUrl) ? null : fallbackUrl;
};

const toExpiresAtMs = (value?: string | number | null): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isFreshCache = (entry: { expiresAtMs: number | null; cachedAt: number }): boolean => {
  if (entry.expiresAtMs) {
    return Date.now() < entry.expiresAtMs - EXPIRY_SAFETY_WINDOW_MS;
  }
  return Date.now() < entry.cachedAt + CACHE_TTL_MS;
};

const buildCacheKey = (req: MediaUrlRequest): string => {
  if (req.storagePath) return `${req.kind}|storage|${req.storagePath}`;
  if (req.assetId) return `${req.kind}|asset|${req.assetId}`;
  if (req.url) return `${req.kind}|url|${req.url}`;
  return `${req.kind}|unknown`;
};

const withFallbackUrl = (result: MediaUrlResult, fallbackUrl: string | null): MediaUrlResult =>
  result.url ? result : { ...result, url: pickSafeFallbackUrl(fallbackUrl) };

const resolveViaStoragePath = async (storagePath: string): Promise<MediaUrlResult> => {
  const data = (await storageApi.getViewUrl(storagePath)) as {
    viewUrl?: string;
    expiresAt?: string;
    storagePath?: string;
  };
  if (!data?.viewUrl) {
    return { url: null, storagePath, source: 'storage' };
  }
  return {
    url: data.viewUrl,
    expiresAt: data.expiresAt ?? null,
    storagePath: data.storagePath ?? storagePath,
    source: 'storage',
  };
};

const resolveViaAssetId = async (assetId: string, kind: MediaKind): Promise<MediaUrlResult> => {
  const response =
    kind === 'video' ? await getVideoAssetViewUrl(assetId) : await getImageAssetViewUrl(assetId);
  if (!response.success) {
    return { url: null, assetId, source: 'preview' };
  }
  const data = response.data;
  return {
    url: data?.viewUrl ?? null,
    expiresAt: (data as { expiresAt?: string; viewUrlExpiresAt?: string } | undefined)?.expiresAt ??
      (data as { viewUrlExpiresAt?: string } | undefined)?.viewUrlExpiresAt ??
      null,
    storagePath: (data as { storagePath?: string } | undefined)?.storagePath ?? null,
    assetId,
    source: 'preview',
  };
};

const resolveFromUrl = async (
  url: string,
  kind: MediaKind,
  preferFresh: boolean
): Promise<MediaUrlResult> => {
  const trimmed = url.trim();
  if (!trimmed) {
    return { url: null, source: 'unknown' };
  }

  if (hasGcsSignedUrlParams(trimmed)) {
    const expiresAtMs = parseGcsSignedUrlExpiryMs(trimmed);
    const isExpired =
      expiresAtMs !== null && Date.now() >= expiresAtMs - EXPIRY_SAFETY_WINDOW_MS;
    if (!isExpired && !preferFresh) {
      return {
        url: trimmed,
        expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        source: 'raw',
      };
    }
    if (!isExpired && preferFresh === false) {
      return { url: trimmed, source: 'raw' };
    }
    if (!isExpired && preferFresh === true) {
      // keep going to refresh if requested
    } else if (!isExpired) {
      return {
        url: trimmed,
        expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        source: 'raw',
      };
    }
  }

  const objectPath = extractStorageObjectPath(trimmed);
  if (objectPath) {
    if (objectPath.startsWith('users/')) {
      const resolved = await resolveViaStoragePath(objectPath);
      if (resolved.url) return resolved;
      return resolved;
    }
    const assetId = objectPath.split('/').filter(Boolean).pop() ?? null;
    if (assetId) {
      const resolved = await resolveViaAssetId(assetId, kind);
      if (resolved.url) return resolved;
      if (isBlockedRawPreviewUrl(trimmed)) return resolved;
    }
  }

  const assetIdFromContent = extractVideoContentAssetId(trimmed);
  if (assetIdFromContent) {
    const resolved = await resolveViaAssetId(assetIdFromContent, 'video');
    if (resolved.url) return resolved;
    if (isBlockedRawPreviewUrl(trimmed)) return resolved;
  }

  const safeFallback = pickSafeFallbackUrl(trimmed);
  if (!safeFallback) {
    return { url: null, source: 'unknown' };
  }
  return { url: safeFallback, source: 'raw' };
};

export async function resolveMediaUrl(req: MediaUrlRequest): Promise<MediaUrlResult> {
  const trimmedUrl = req.url?.trim?.() ?? null;
  const resolvedReq: MediaUrlRequest = {
    ...req,
    url: trimmedUrl || null,
    storagePath: req.storagePath?.trim?.() ?? null,
    assetId: req.assetId?.trim?.() ?? null,
    preferFresh: req.preferFresh ?? true,
  };

  const cacheKey = buildCacheKey(resolvedReq);
  const cached = cache.get(cacheKey);
  if (cached && isFreshCache(cached)) {
    return cached.result;
  }

  const existing = inflight.get(cacheKey);
  if (existing) {
    return await existing;
  }

  const task: Promise<MediaUrlResult> = (async (): Promise<MediaUrlResult> => {
    try {
      if (resolvedReq.storagePath) {
        const normalizedPath = resolvedReq.storagePath;
        if (normalizedPath.startsWith('users/')) {
          const result = await resolveViaStoragePath(normalizedPath);
          return withFallbackUrl(result, resolvedReq.url ?? null);
        }
        const assetId = normalizedPath.split('/').filter(Boolean).pop();
        if (assetId) {
          const result = await resolveViaAssetId(assetId, resolvedReq.kind);
          return withFallbackUrl(result, resolvedReq.url ?? null);
        }
      }

      if (resolvedReq.assetId) {
        const result = await resolveViaAssetId(resolvedReq.assetId, resolvedReq.kind);
        return withFallbackUrl(result, resolvedReq.url ?? null);
      }

      if (resolvedReq.url) {
        return await resolveFromUrl(resolvedReq.url, resolvedReq.kind, resolvedReq.preferFresh ?? true);
      }

      return { url: null, source: 'unknown' };
    } catch (error) {
      log.warn('Failed to resolve media URL', {
        kind: resolvedReq.kind,
        storagePath: resolvedReq.storagePath ?? null,
        assetId: resolvedReq.assetId ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      return { url: pickSafeFallbackUrl(resolvedReq.url ?? null), source: 'unknown' };
    }
  })();

  inflight.set(cacheKey, task);
  try {
    const result = await task;
    const expiresAtMs = toExpiresAtMs(result.expiresAt) ?? (result.url ? parseGcsSignedUrlExpiryMs(result.url) : null);
    cache.set(cacheKey, { result, expiresAtMs, cachedAt: Date.now() });
    return result;
  } finally {
    inflight.delete(cacheKey);
  }
}

export function invalidateMediaUrlCache(key: string): void {
  cache.delete(key);
}

export function buildMediaCacheKey(req: MediaUrlRequest): string {
  return buildCacheKey(req);
}
