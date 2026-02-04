import type { MediaKind } from '@/services/media/MediaUrlResolver';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';
import { hasGcsSignedUrlParams } from '@/utils/storageUrl';

export async function refreshSignedUrl(rawUrl: string, kind: MediaKind): Promise<string | null> {
  const trimmed = rawUrl?.trim?.() ?? '';
  if (!trimmed) return null;
  if (!hasGcsSignedUrlParams(trimmed)) return null;

  const result = await resolveMediaUrl({ kind, url: trimmed, preferFresh: true });
  return result.url ?? null;
}

export default refreshSignedUrl;
