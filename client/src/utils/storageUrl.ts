const VIDEO_CONTENT_PREFIX = '/api/preview/video/content/';

function safeParseUrl(rawUrl: string): URL | null {
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
}

export function extractStorageObjectPath(rawUrl: string): string | null {
  const url = safeParseUrl(rawUrl);
  if (!url) return null;

  const host = url.host;
  if (host === 'storage.googleapis.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return decodeURIComponent(parts.slice(1).join('/'));
  }

  if (host.endsWith('.storage.googleapis.com')) {
    const path = url.pathname.replace(/^\/+/, '');
    return path ? decodeURIComponent(path) : null;
  }

  if (host === 'firebasestorage.googleapis.com') {
    const match =
      url.pathname.match(/\/b\/[^/]+\/o\/(.+)$/) ||
      url.pathname.match(/\/download\/storage\/v1\/b\/[^/]+\/o\/(.+)$/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  if (url.protocol === 'gs:') {
    const path = url.pathname.replace(/^\/+/, '');
    return path ? decodeURIComponent(path) : null;
  }

  return null;
}

export function extractVideoContentAssetId(rawUrl: string): string | null {
  const url = safeParseUrl(rawUrl);
  if (!url) return null;
  const path = url.pathname;
  if (!path.includes(VIDEO_CONTENT_PREFIX)) {
    return null;
  }
  const relative = path.split(VIDEO_CONTENT_PREFIX)[1] || '';
  const assetId = relative.split('/')[0]?.trim() || '';
  return assetId || null;
}

export function hasGcsSignedUrlParams(rawUrl: string): boolean {
  const url = safeParseUrl(rawUrl);
  if (!url) return false;
  return (
    url.searchParams.has('X-Goog-Algorithm') ||
    url.searchParams.has('X-Goog-Signature') ||
    url.searchParams.has('X-Goog-Expires')
  );
}

export function parseGcsSignedUrlExpiryMs(rawUrl: string): number | null {
  const url = safeParseUrl(rawUrl);
  if (!url) return null;
  const date = url.searchParams.get('X-Goog-Date');
  const expires = url.searchParams.get('X-Goog-Expires');
  if (!date || !expires) return null;
  if (!/^\d{8}T\d{6}Z$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  const hour = Number(date.slice(9, 11));
  const minute = Number(date.slice(11, 13));
  const second = Number(date.slice(13, 15));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  const expiresSeconds = Number.parseInt(expires, 10);
  if (!Number.isFinite(expiresSeconds)) return null;
  const baseMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(baseMs)) return null;
  return baseMs + expiresSeconds * 1000;
}
