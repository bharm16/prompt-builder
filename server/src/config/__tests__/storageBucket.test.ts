import { describe, expect, it } from 'vitest';
import { normalizeBucketName, resolveBucketName } from '../storageBucket';

describe('storageBucket', () => {
  it('normalizes gs:// bucket names', () => {
    expect(normalizeBucketName('gs://my-bucket')).toBe('my-bucket');
  });

  it('normalizes Firebase storage URLs', () => {
    expect(
      normalizeBucketName('https://firebasestorage.googleapis.com/v0/b/mybucket.appspot.com/o')
    ).toBe('mybucket.appspot.com');
  });

  it('normalizes firebasestorage.app hostnames to appspot.com', () => {
    expect(normalizeBucketName('mybucket.firebasestorage.app')).toBe('mybucket.appspot.com');
  });

  it('resolves bucket name from canonical env var first', () => {
    const env = {
      GCS_BUCKET_NAME: 'gs://canonical-bucket',
      FIREBASE_STORAGE_BUCKET: 'fallback-bucket',
    } as NodeJS.ProcessEnv;

    expect(resolveBucketName(env)).toBe('canonical-bucket');
  });

  it('falls back to FIREBASE_STORAGE_BUCKET when canonical is absent', () => {
    const env = {
      FIREBASE_STORAGE_BUCKET: 'fallback-bucket',
    } as NodeJS.ProcessEnv;

    expect(resolveBucketName(env)).toBe('fallback-bucket');
  });
});
