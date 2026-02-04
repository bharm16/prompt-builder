import { storageApi } from '@/api/storageApi';
import {
  getImageAssetViewUrl,
  getVideoAssetViewUrl,
} from '@/features/preview/api/previewApi';
import {
  extractStorageObjectPath,
  extractVideoContentAssetId,
  hasGcsSignedUrlParams,
} from '@/utils/storageUrl';
import { logger } from '@/services/LoggingService';

type RefreshKind = 'image' | 'video';

const log = logger.child('refreshSignedUrl');
const inFlight = new Map<string, Promise<string | null>>();

const resolveViaAssetId = async (
  assetId: string,
  kind: RefreshKind
): Promise<string | null> => {
  try {
    const response =
      kind === 'video'
        ? await getVideoAssetViewUrl(assetId)
        : await getImageAssetViewUrl(assetId);
    if (!response.success) {
      return null;
    }
    return response.data?.viewUrl ?? null;
  } catch {
    return null;
  }
};

export async function refreshSignedUrl(
  rawUrl: string,
  kind: RefreshKind
): Promise<string | null> {
  const trimmed = rawUrl?.trim?.() ?? '';
  if (!trimmed) return null;
  if (!hasGcsSignedUrlParams(trimmed)) return null;

  const cacheKey = `${kind}|${trimmed}`;
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return await existing;
  }

  const task = (async () => {
    const objectPath = extractStorageObjectPath(trimmed);
    if (objectPath) {
      if (objectPath.startsWith('users/')) {
        try {
          const data = (await storageApi.getViewUrl(objectPath)) as { viewUrl?: string };
          return data?.viewUrl ?? null;
        } catch (error) {
          log.debug('Failed to refresh via storage path', {
            objectPath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const assetId = objectPath.split('/').filter(Boolean).pop();
      if (assetId) {
        const refreshed = await resolveViaAssetId(assetId, kind);
        if (refreshed) return refreshed;
      }
    }

    if (kind === 'video') {
      const assetId = extractVideoContentAssetId(trimmed);
      if (assetId) {
        const refreshed = await resolveViaAssetId(assetId, 'video');
        if (refreshed) return refreshed;
      }
    }

    if (kind === 'image') {
      const assetId = extractVideoContentAssetId(trimmed);
      if (assetId) {
        const refreshed = await resolveViaAssetId(assetId, 'video');
        if (refreshed) return refreshed;
      }
    }

    return null;
  })();

  inFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(cacheKey);
  }
}

export default refreshSignedUrl;
