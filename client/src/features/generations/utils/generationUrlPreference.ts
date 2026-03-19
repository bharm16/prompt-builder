import { hasGcsSignedUrlParams, parseGcsSignedUrlExpiryMs } from '@/utils/storageUrl';
import type { Generation } from '../types';

export const SIGNED_URL_PREFERENCE_BUFFER_MS = 2 * 60 * 1000;

export const isV4SignedUrl = (url: string): boolean =>
  url.includes('X-Goog-Algorithm=') ||
  url.includes('X-Goog-Signature=') ||
  url.includes('X-Goog-Credential=');

export const pickPreferredUrl = (
  incoming?: string | null,
  local?: string | null,
  nowMs: number = Date.now()
): string | null | undefined => {
  if (!incoming) return local ?? incoming;
  if (!local) return incoming;
  if (incoming === local) return incoming;

  const incomingSigned = hasGcsSignedUrlParams(incoming);
  const localSigned = hasGcsSignedUrlParams(local);

  if (!incomingSigned && localSigned) {
    return incoming;
  }
  if (incomingSigned && !localSigned) {
    return local;
  }
  if (!incomingSigned && !localSigned) {
    return incoming;
  }

  const incomingExpiry = parseGcsSignedUrlExpiryMs(incoming);
  const localExpiry = parseGcsSignedUrlExpiryMs(local);
  const incomingExpired =
    incomingExpiry !== null && nowMs >= incomingExpiry - SIGNED_URL_PREFERENCE_BUFFER_MS;
  const localExpired =
    localExpiry !== null && nowMs >= localExpiry - SIGNED_URL_PREFERENCE_BUFFER_MS;

  if (incomingExpired && !localExpired) return local;
  if (!incomingExpired && localExpired) return incoming;

  if (incomingExpiry && localExpiry && incomingExpiry !== localExpiry) {
    return incomingExpiry >= localExpiry ? incoming : local;
  }

  const incomingV4 = isV4SignedUrl(incoming);
  const localV4 = isV4SignedUrl(local);
  if (incomingV4 !== localV4) {
    return incomingV4 ? incoming : local;
  }

  return incoming;
};

export const mergeMediaUrls = (
  incoming: string[] | undefined,
  local: string[] | undefined,
  nowMs: number
): string[] => {
  if (!incoming || incoming.length === 0) {
    return local ? [...local] : [];
  }

  return incoming.map((url, index) =>
    (pickPreferredUrl(url, local?.[index], nowMs) ?? url)
  );
};

export const mergeGenerations = (
  incoming: Generation[] | undefined,
  local: Generation[]
): Generation[] | undefined => {
  if (!incoming) return incoming;
  if (!local.length) return incoming;

  const nowMs = Date.now();
  const localById = new Map(local.map((gen) => [gen.id, gen]));

  return incoming.map((gen) => {
    const existing = localById.get(gen.id);
    if (!existing) return gen;

    const mergedMediaUrls = mergeMediaUrls(gen.mediaUrls, existing.mediaUrls, nowMs);
    const mergedThumbnail =
      pickPreferredUrl(gen.thumbnailUrl ?? null, existing.thumbnailUrl ?? null, nowMs) ??
      gen.thumbnailUrl ??
      existing.thumbnailUrl ??
      null;

    const mediaUrlsChanged =
      mergedMediaUrls.length !== gen.mediaUrls.length ||
      mergedMediaUrls.some((url, index) => url !== gen.mediaUrls[index]);
    const thumbnailChanged = mergedThumbnail !== (gen.thumbnailUrl ?? null);

    if (!mediaUrlsChanged && !thumbnailChanged) {
      return gen;
    }

    return {
      ...gen,
      mediaUrls: mergedMediaUrls,
      thumbnailUrl: mergedThumbnail,
    };
  });
};
