import { describe, it, expect } from 'vitest';
import {
  serializeKeyframes,
  hydrateKeyframes,
  areKeyframesEqual,
} from '../keyframeTransforms';
import type { PromptKeyframeSource } from '@features/prompt-optimizer/types/domain/prompt-session';

const tile = (id: string, url: string, source: PromptKeyframeSource = 'upload', assetId?: string) => ({
  id,
  url,
  source,
  ...(assetId ? { assetId } : {}),
});

const promptKf = (url: string, source: PromptKeyframeSource = 'upload', id?: string, assetId?: string) => ({
  url,
  source,
  ...(id ? { id } : {}),
  ...(assetId ? { assetId } : {}),
});

describe('serializeKeyframes', () => {
  describe('edge cases', () => {
    it('returns empty array for null', () => {
      expect(serializeKeyframes(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(serializeKeyframes(undefined)).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      expect(serializeKeyframes([])).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('serializes tiles to prompt keyframes', () => {
      const tiles = [tile('k1', 'https://img.com/1.png', 'upload')];
      const result = serializeKeyframes(tiles);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('k1');
      expect(result[0]!.url).toBe('https://img.com/1.png');
      expect(result[0]!.source).toBe('upload');
    });

    it('limits to MAX_KEYFRAMES (3)', () => {
      const tiles = [
        tile('k1', 'url1'),
        tile('k2', 'url2'),
        tile('k3', 'url3'),
        tile('k4', 'url4'),
      ];
      expect(serializeKeyframes(tiles)).toHaveLength(3);
    });

    it('includes assetId only when present', () => {
      const withAsset = [tile('k1', 'url1', 'upload', 'asset-123')];
      const withoutAsset = [tile('k2', 'url2', 'upload')];

      expect(serializeKeyframes(withAsset)[0]).toHaveProperty('assetId', 'asset-123');
      expect(serializeKeyframes(withoutAsset)[0]).not.toHaveProperty('assetId');
    });
  });
});

describe('hydrateKeyframes', () => {
  describe('edge cases', () => {
    it('returns empty array for null', () => {
      expect(hydrateKeyframes(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(hydrateKeyframes(undefined)).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      expect(hydrateKeyframes([])).toEqual([]);
    });

    it('filters out keyframes with empty url', () => {
      const keyframes = [promptKf('', 'upload', 'k1')];
      expect(hydrateKeyframes(keyframes)).toHaveLength(0);
    });

    it('filters out keyframes with whitespace-only url', () => {
      const keyframes = [promptKf('   ', 'upload', 'k1')];
      expect(hydrateKeyframes(keyframes)).toHaveLength(0);
    });
  });

  describe('core behavior', () => {
    it('preserves existing id', () => {
      const keyframes = [promptKf('https://img.com/1.png', 'upload', 'existing-id')];
      const result = hydrateKeyframes(keyframes);
      expect(result[0]!.id).toBe('existing-id');
    });

    it('generates id when not provided', () => {
      const keyframes = [promptKf('https://img.com/1.png', 'upload')];
      const result = hydrateKeyframes(keyframes);
      expect(result[0]!.id).toBeTruthy();
      expect(typeof result[0]!.id).toBe('string');
    });

    it('defaults source to upload when missing', () => {
      const keyframes = [{ url: 'https://img.com/1.png' }];
      const result = hydrateKeyframes(keyframes as never);
      expect(result[0]!.source).toBe('upload');
    });

    it('limits to MAX_KEYFRAMES (3)', () => {
      const keyframes = [
        promptKf('url1', 'upload', 'k1'),
        promptKf('url2', 'upload', 'k2'),
        promptKf('url3', 'upload', 'k3'),
        promptKf('url4', 'upload', 'k4'),
      ];
      expect(hydrateKeyframes(keyframes)).toHaveLength(3);
    });

    it('includes assetId when present', () => {
      const keyframes = [promptKf('url1', 'upload', 'k1', 'asset-1')];
      expect(hydrateKeyframes(keyframes)[0]).toHaveProperty('assetId', 'asset-1');
    });
  });
});

describe('areKeyframesEqual', () => {
  describe('edge cases', () => {
    it('returns true for both null', () => {
      expect(areKeyframesEqual(null, null)).toBe(true);
    });

    it('returns true for both undefined', () => {
      expect(areKeyframesEqual(undefined, undefined)).toBe(true);
    });

    it('returns true for both empty arrays', () => {
      expect(areKeyframesEqual([], [])).toBe(true);
    });

    it('returns false when lengths differ', () => {
      expect(areKeyframesEqual(
        [tile('k1', 'url1')],
        [tile('k1', 'url1'), tile('k2', 'url2')]
      )).toBe(false);
    });

    it('returns false when null vs non-empty', () => {
      expect(areKeyframesEqual(null, [tile('k1', 'url1')])).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('returns true for identical keyframes', () => {
      const left = [tile('k1', 'url1', 'upload', 'asset-1')];
      const right = [tile('k1', 'url1', 'upload', 'asset-1')];
      expect(areKeyframesEqual(left, right)).toBe(true);
    });

    it('returns false when urls differ', () => {
      expect(areKeyframesEqual(
        [tile('k1', 'url1')],
        [tile('k1', 'url2')]
      )).toBe(false);
    });

    it('returns false when sources differ', () => {
      expect(areKeyframesEqual(
        [tile('k1', 'url1', 'upload')],
        [tile('k1', 'url1', 'asset')]
      )).toBe(false);
    });

    it('returns false when assetId differs', () => {
      expect(areKeyframesEqual(
        [tile('k1', 'url1', 'upload', 'asset-1')],
        [tile('k1', 'url1', 'upload', 'asset-2')]
      )).toBe(false);
    });

    it('ignores id differences (compares by url, source, assetId only)', () => {
      expect(areKeyframesEqual(
        [tile('k1', 'url1', 'upload')],
        [tile('k999', 'url1', 'upload')]
      )).toBe(true);
    });

    it('only compares first MAX_KEYFRAMES (3)', () => {
      const left = [tile('k1', 'url1'), tile('k2', 'url2'), tile('k3', 'url3'), tile('k4', 'urlX')];
      const right = [tile('k1', 'url1'), tile('k2', 'url2'), tile('k3', 'url3'), tile('k4', 'urlY')];
      // Both arrays have 4 items, but normalizeForCompare limits to 3
      expect(areKeyframesEqual(left, right)).toBe(true);
    });
  });
});
