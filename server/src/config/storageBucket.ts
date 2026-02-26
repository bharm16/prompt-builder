export const PRIMARY_BUCKET_ENV = 'GCS_BUCKET_NAME';
export const FALLBACK_BUCKET_ENV = 'FIREBASE_STORAGE_BUCKET';

function extractBucketFromUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const match = parsed.pathname.match(/\/b\/([^/]+)\/o/);
      if (match?.[1]) {
        return match[1];
      }
    }

    if (parsed.hostname === 'storage.googleapis.com') {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts[0]) {
        return pathParts[0];
      }
    }

    return parsed.hostname;
  } catch {
    return raw;
  }
}

export function normalizeBucketName(raw: string): string {
  let bucketName = raw.trim();
  if (!bucketName) {
    throw new Error('Storage bucket name is required');
  }

  if (bucketName.startsWith('gs://')) {
    bucketName = bucketName.slice(5);
  }

  if (bucketName.startsWith('http://') || bucketName.startsWith('https://')) {
    bucketName = extractBucketFromUrl(bucketName);
  }

  bucketName = bucketName.replace(/^\/+/, '').split(/[/?#]/)[0] || '';
  if (bucketName.endsWith('.firebasestorage.app')) {
    bucketName = bucketName.replace(/\.firebasestorage\.app$/, '.appspot.com');
  }

  if (!bucketName) {
    throw new Error('Storage bucket name is required');
  }

  return bucketName;
}

export function resolveBucketName(
  env: NodeJS.ProcessEnv = process.env,
  explicit?: string
): string {
  const rawBucketName = explicit || env[PRIMARY_BUCKET_ENV] || env[FALLBACK_BUCKET_ENV];
  if (!rawBucketName || rawBucketName.trim().length === 0) {
    throw new Error(
      `Missing storage bucket configuration: ${PRIMARY_BUCKET_ENV} or ${FALLBACK_BUCKET_ENV}`
    );
  }

  return normalizeBucketName(rawBucketName);
}
