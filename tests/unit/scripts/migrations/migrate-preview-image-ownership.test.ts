import { describe, expect, it } from 'vitest';
import type { Bucket } from '@google-cloud/storage';
import {
  collectSessionMappings,
  migrateMappings,
  type MappingEntry,
  type Stats,
} from '@migrations/migrate-preview-image-ownership.ts';

function createStats(): Stats {
  return {
    scannedSessions: 0,
    scannedContinuitySessions: 0,
    mappingsDiscovered: 0,
    uniqueUserAssetMappings: 0,
    uniqueAssetIds: 0,
    conflicts: 0,
    plannedCopies: 0,
    copied: 0,
    skippedConflicts: 0,
    skippedTargetExists: 0,
    missingSource: 0,
    errors: 0,
  };
}

function createBucketMock(existingPaths: Set<string>): {
  bucket: Bucket;
  fileCalls: string[];
  copiedSourcePaths: string[];
} {
  const fileCalls: string[] = [];
  const copiedSourcePaths: string[] = [];

  const bucket = {
    file: (path: string) => {
      fileCalls.push(path);
      return {
        exists: async (): Promise<[boolean]> => [existingPaths.has(path)],
        copy: async (): Promise<void> => {
          copiedSourcePaths.push(path);
        },
      };
    },
  } as unknown as Bucket;

  return { bucket, fileCalls, copiedSourcePaths };
}

describe('migrate-preview-image-ownership migration mapping', () => {
  it('collects generation media URL, thumbnail URL, and mediaAssetIds references', () => {
    const mappings = new Map<string, MappingEntry>();
    const ownersByAsset = new Map<string, Set<string>>();

    collectSessionMappings(
      'session-1',
      {
        userId: 'user-1',
        prompt: {
          versions: [
            {
              generations: [
                {
                  mediaUrls: [
                    'https://storage.googleapis.com/vidra-media-prod/image-previews/media-asset-1?X-Goog-Signature=abc',
                  ],
                  thumbnailUrl:
                    'https://firebasestorage.googleapis.com/v0/b/app/o/image-previews%2Fthumb-asset-1?alt=media',
                  mediaAssetIds: [
                    'users/user-1/generations/video.mp4',
                    'plain-media-asset-id',
                    'https://storage.googleapis.com/vidra-media-prod/image-previews/media-asset-2',
                  ],
                },
              ],
            },
          ],
        },
      },
      mappings,
      ownersByAsset
    );

    const mappedAssetIds = new Set(Array.from(mappings.values()).map((entry) => entry.assetId));
    expect(mappedAssetIds.has('media-asset-1')).toBe(true);
    expect(mappedAssetIds.has('thumb-asset-1')).toBe(true);
    expect(mappedAssetIds.has('plain-media-asset-id')).toBe(true);
    expect(mappedAssetIds.has('media-asset-2')).toBe(true);
    expect(mappedAssetIds.has('users')).toBe(false);
  });

  it('collects keyframe URL, storagePath, and assetId references', () => {
    const mappings = new Map<string, MappingEntry>();
    const ownersByAsset = new Map<string, Set<string>>();

    collectSessionMappings(
      'session-2',
      {
        userId: 'user-2',
        prompt: {
          keyframes: [
            {
              url: 'https://storage.googleapis.com/vidra-media-prod/image-previews/keyframe-url-asset.webp',
              storagePath: 'image-previews/keyframe-storage-asset',
              assetId: 'plain-keyframe-asset',
            },
            {
              assetId: 'users/user-2/generations/not-an-image-path.mp4',
            },
          ],
        },
      },
      mappings,
      ownersByAsset
    );

    const mappedAssetIds = new Set(Array.from(mappings.values()).map((entry) => entry.assetId));
    expect(mappedAssetIds.has('keyframe-url-asset')).toBe(true);
    expect(mappedAssetIds.has('keyframe-storage-asset')).toBe(true);
    expect(mappedAssetIds.has('plain-keyframe-asset')).toBe(true);
    expect(mappedAssetIds.has('not-an-image-path')).toBe(false);
  });
});

describe('migrate-preview-image-ownership apply behavior', () => {
  it('skips conflicted assets and does not attempt copy for them', async () => {
    const mappings: MappingEntry[] = [
      {
        userId: 'user-1',
        assetId: 'conflicted-asset',
        sources: new Set(['sessions/a']),
      },
      {
        userId: 'user-1',
        assetId: 'safe-asset',
        sources: new Set(['sessions/b']),
      },
    ];

    const { bucket, copiedSourcePaths, fileCalls } = createBucketMock(
      new Set(['image-previews/safe-asset'])
    );

    const stats = createStats();
    await migrateMappings(
      bucket,
      mappings,
      new Set(['conflicted-asset']),
      { mode: 'apply', limit: null },
      stats
    );

    expect(stats.skippedConflicts).toBe(1);
    expect(stats.plannedCopies).toBe(1);
    expect(stats.copied).toBe(1);
    expect(copiedSourcePaths).toEqual(['image-previews/safe-asset']);
    expect(fileCalls.some((path) => path.includes('conflicted-asset'))).toBe(false);
  });
});
