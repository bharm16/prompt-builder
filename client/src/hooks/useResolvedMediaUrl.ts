import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaKind, MediaUrlRequest, MediaUrlResult } from '@/services/media/MediaUrlResolver';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';

interface UseResolvedMediaUrlOptions {
  kind: MediaKind;
  url?: string | null;
  storagePath?: string | null;
  assetId?: string | null;
  enabled?: boolean;
  preferFresh?: boolean;
}

interface UseResolvedMediaUrlResult {
  url: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: (reason?: string) => Promise<MediaUrlResult>;
}

export function useResolvedMediaUrl({
  kind,
  url,
  storagePath,
  assetId,
  enabled = true,
  preferFresh = true,
}: UseResolvedMediaUrlOptions): UseResolvedMediaUrlResult {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(url ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestRef = useRef<MediaUrlRequest | null>(null);

  const refresh = useCallback(
    async (_reason?: string) => {
      const request: MediaUrlRequest = {
        kind,
        url: url ?? null,
        storagePath: storagePath ?? null,
        assetId: assetId ?? null,
        preferFresh,
      };
      lastRequestRef.current = request;
      setLoading(true);
      setError(null);
      try {
        const result = await resolveMediaUrl(request);
        if (lastRequestRef.current === request) {
          setResolvedUrl(result.url ?? null);
          setExpiresAt(result.expiresAt ?? null);
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resolve media URL';
        if (lastRequestRef.current === request) {
          setError(message);
        }
        return { url: url ?? null, source: 'unknown' as const };
      } finally {
        if (lastRequestRef.current === request) {
          setLoading(false);
        }
      }
    },
    [assetId, kind, preferFresh, storagePath, url]
  );

  useEffect(() => {
    setResolvedUrl(url ?? null);
    setExpiresAt(null);
    setError(null);
  }, [url, storagePath, assetId, kind]);

  useEffect(() => {
    if (!enabled) return;
    void refresh('init');
  }, [enabled, refresh]);

  return {
    url: resolvedUrl,
    expiresAt,
    loading,
    error,
    refresh,
  };
}

export default useResolvedMediaUrl;
