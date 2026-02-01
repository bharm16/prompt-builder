import { describe, it, expect } from 'vitest';
import { serializeGeneration, areGenerationsEqual } from '../generationComparison';
import type { Generation } from '../../types';

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-123',
  tier: 'draft',
  status: 'completed',
  model: 'wan-2.2',
  prompt: 'A cat walking',
  promptVersionId: 'v1',
  createdAt: 1700000000000,
  completedAt: 1700000001000,
  mediaType: 'video',
  mediaUrls: ['https://example.com/video.mp4'],
  ...overrides,
});

describe('serializeGeneration', () => {
  describe('edge cases', () => {
    it('serializes null/undefined optional fields consistently', () => {
      const gen1 = createGeneration({ estimatedCost: undefined, actualCost: null });
      const gen2 = createGeneration({ estimatedCost: null, actualCost: undefined });

      // Both should produce identical output when optional fields are missing
      expect(serializeGeneration(gen1)).toBe(serializeGeneration(gen2));
    });

    it('serializes empty arrays consistently', () => {
      const gen = createGeneration({ mediaUrls: [], mediaAssetIds: undefined });
      const serialized = JSON.parse(serializeGeneration(gen));

      expect(serialized.mediaUrls).toEqual([]);
      expect(serialized.mediaAssetIds).toEqual([]);
    });

    it('includes all fields in deterministic order', () => {
      const gen = createGeneration({
        estimatedCost: 5,
        actualCost: 4,
        aspectRatio: '16:9',
        duration: 5,
        fps: 24,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        error: null,
        mediaAssetIds: ['asset-1'],
      });

      const serialized = JSON.parse(serializeGeneration(gen));
      const keys = Object.keys(serialized);

      // Verify field order is consistent
      expect(keys).toEqual([
        'id',
        'status',
        'tier',
        'model',
        'mediaType',
        'promptVersionId',
        'createdAt',
        'completedAt',
        'estimatedCost',
        'actualCost',
        'aspectRatio',
        'duration',
        'fps',
        'thumbnailUrl',
        'characterAssetId',
        'faceSwapApplied',
        'faceSwapUrl',
        'error',
        'mediaUrls',
        'mediaAssetIds',
      ]);
    });
  });

  describe('core behavior', () => {
    it('produces different output for generations with different status', () => {
      const pending = createGeneration({ status: 'pending' });
      const completed = createGeneration({ status: 'completed' });

      expect(serializeGeneration(pending)).not.toBe(serializeGeneration(completed));
    });

    it('produces different output for generations with different mediaUrls', () => {
      const gen1 = createGeneration({ mediaUrls: ['url-1'] });
      const gen2 = createGeneration({ mediaUrls: ['url-2'] });

      expect(serializeGeneration(gen1)).not.toBe(serializeGeneration(gen2));
    });

    it('null-coalesces promptVersionId null to null in output', () => {
      const gen = createGeneration({ promptVersionId: null });
      const serialized = JSON.parse(serializeGeneration(gen));

      expect(serialized.promptVersionId).toBeNull();
    });
  });
});

describe('areGenerationsEqual', () => {
  describe('edge cases', () => {
    it('returns true when both arrays are null', () => {
      expect(areGenerationsEqual(null, null)).toBe(true);
    });

    it('returns true when both arrays are undefined', () => {
      expect(areGenerationsEqual(undefined, undefined)).toBe(true);
    });

    it('returns true when one is null and other is undefined', () => {
      expect(areGenerationsEqual(null, undefined)).toBe(true);
    });

    it('returns false when left is null but right has elements', () => {
      expect(areGenerationsEqual(null, [createGeneration()])).toBe(false);
    });

    it('returns false when right is null but left has elements', () => {
      expect(areGenerationsEqual([createGeneration()], null)).toBe(false);
    });

    it('returns false when arrays have different lengths', () => {
      const gen1 = createGeneration({ id: 'gen-1' });
      const gen2 = createGeneration({ id: 'gen-2' });

      expect(areGenerationsEqual([gen1], [gen1, gen2])).toBe(false);
    });

    it('returns true for two empty arrays', () => {
      expect(areGenerationsEqual([], [])).toBe(true);
    });

    it('returns false when arrays have same elements in different order', () => {
      const gen1 = createGeneration({ id: 'gen-1', createdAt: 1 });
      const gen2 = createGeneration({ id: 'gen-2', createdAt: 2 });

      expect(areGenerationsEqual([gen1, gen2], [gen2, gen1])).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('returns true when generations are identical', () => {
      const gen = createGeneration();

      expect(areGenerationsEqual([gen], [gen])).toBe(true);
    });

    it('returns true for structurally identical but different object references', () => {
      const gen1 = createGeneration({ id: 'gen-1', status: 'completed' });
      const gen2 = createGeneration({ id: 'gen-1', status: 'completed' });

      expect(gen1).not.toBe(gen2); // Different references
      expect(areGenerationsEqual([gen1], [gen2])).toBe(true);
    });

    it('returns false when a generation property differs', () => {
      const gen1 = createGeneration({ status: 'pending' });
      const gen2 = createGeneration({ status: 'completed' });

      expect(areGenerationsEqual([gen1], [gen2])).toBe(false);
    });

    it('compares multiple generations element by element', () => {
      const gens1 = [
        createGeneration({ id: 'gen-1' }),
        createGeneration({ id: 'gen-2' }),
      ];
      const gens2 = [
        createGeneration({ id: 'gen-1' }),
        createGeneration({ id: 'gen-2' }),
      ];

      expect(areGenerationsEqual(gens1, gens2)).toBe(true);
    });

    it('detects difference in last element', () => {
      const gen1 = createGeneration({ id: 'gen-1' });
      const gen2a = createGeneration({ id: 'gen-2', mediaUrls: ['url-a'] });
      const gen2b = createGeneration({ id: 'gen-2', mediaUrls: ['url-b'] });

      expect(areGenerationsEqual([gen1, gen2a], [gen1, gen2b])).toBe(false);
    });
  });
});
