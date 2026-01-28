import { describe, it, expect } from 'vitest';

import { extractStorageObjectPath, extractVideoContentAssetId } from '@/utils/storageUrl';

describe('storageUrl', () => {
  describe('error handling', () => {
    it('returns null for invalid URLs', () => {
      expect(extractStorageObjectPath('not-a-url')).toBeNull();
      expect(extractVideoContentAssetId('')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('extracts object paths from firebase storage URLs', () => {
      const url =
        'https://firebasestorage.googleapis.com/v0/b/app/o/folder%2Fimage.png?alt=media';

      expect(extractStorageObjectPath(url)).toBe('folder/image.png');
    });

    it('extracts object paths from gs:// URLs', () => {
      const url = 'gs://bucket-name/path/to/video.mp4';

      expect(extractStorageObjectPath(url)).toBe('path/to/video.mp4');
    });
  });

  describe('core behavior', () => {
    it('extracts object paths from Google Cloud Storage URLs', () => {
      const url = 'https://storage.googleapis.com/my-bucket/path/to/file.png';

      expect(extractStorageObjectPath(url)).toBe('path/to/file.png');
    });

    it('extracts asset IDs from preview content URLs', () => {
      const url = 'https://example.com/api/preview/video/content/asset-123/stream.m3u8';

      expect(extractVideoContentAssetId(url)).toBe('asset-123');
    });
  });
});
