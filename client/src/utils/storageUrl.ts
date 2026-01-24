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

