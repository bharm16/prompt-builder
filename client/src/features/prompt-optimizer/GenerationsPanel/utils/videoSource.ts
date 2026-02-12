import { extractStorageObjectPath, extractVideoContentAssetId } from '@/utils/storageUrl';

interface VideoSourceResolution {
  storagePath: string | null;
  assetId: string | null;
}

const normalizeRef = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isStoragePathRef = (value: string | null): boolean =>
  Boolean(value && value.startsWith('users/'));

export function resolvePrimaryVideoSource(
  mediaUrl: string | null | undefined,
  primaryMediaRef: string | null | undefined
): VideoSourceResolution {
  const normalizedRef = normalizeRef(primaryMediaRef);
  const storagePath = isStoragePathRef(normalizedRef)
    ? normalizedRef
    : (mediaUrl ? extractStorageObjectPath(mediaUrl) : null);
  const assetIdFromRef =
    normalizedRef && !isStoragePathRef(normalizedRef) ? normalizedRef : null;
  const assetIdFromUrl = mediaUrl ? extractVideoContentAssetId(mediaUrl) : null;

  return {
    storagePath,
    assetId: assetIdFromRef ?? assetIdFromUrl,
  };
}
