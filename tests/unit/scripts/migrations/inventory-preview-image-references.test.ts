import { describe, expect, it } from 'vitest';
import { findReasons } from '@migrations/inventory-preview-image-references.ts';

describe('inventory-preview-image-references reason tagging', () => {
  it('adds generation-specific reason tags', () => {
    const mediaUrlReasons = findReasons(
      'prompt.versions.[].generations.[].mediaUrls.[]',
      'https://storage.googleapis.com/vidra-media-prod/image-previews/media-asset'
    );
    const thumbnailReasons = findReasons(
      'prompt.versions.[].generations.[].thumbnailUrl',
      'https://storage.googleapis.com/vidra-media-prod/image-previews/thumb-asset'
    );
    const mediaAssetIdReasons = findReasons(
      'prompt.versions.[].generations.[].mediaAssetIds.[]',
      'plain-asset-id'
    );

    expect(mediaUrlReasons).toContain('path:generations-mediaUrls');
    expect(thumbnailReasons).toContain('path:generations-thumbnailUrl');
    expect(mediaAssetIdReasons).toContain('path:generations-mediaAssetIds');
  });

  it('adds keyframe-specific reason tags', () => {
    const keyframeUrlReasons = findReasons(
      'prompt.keyframes.[].url',
      'https://storage.googleapis.com/vidra-media-prod/image-previews/keyframe-url'
    );
    const keyframeStorageReasons = findReasons(
      'prompt.keyframes.[].storagePath',
      'image-previews/keyframe-storage'
    );
    const keyframeAssetIdReasons = findReasons(
      'prompt.keyframes.[].assetId',
      'plain-keyframe-asset'
    );

    expect(keyframeUrlReasons).toContain('path:keyframes-url');
    expect(keyframeStorageReasons).toContain('path:keyframes-storagePath');
    expect(keyframeAssetIdReasons).toContain('path:keyframes-assetId');
  });

  it('retains generic image-previews marker detection for unknown paths', () => {
    const reasons = findReasons(
      'some.unknown.location',
      'https://example.com/image-previews/legacy-asset'
    );

    expect(reasons).toContain('value:contains-image-previews-path');
  });
});
