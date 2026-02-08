import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createGenerationId,
  resolveGenerationOptions,
  buildGeneration,
} from '../generationUtils';
import { getModelConfig } from '../../config/generationConfig';
import type { GenerationParams } from '../../types';

vi.mock('../../config/generationConfig', () => ({
  getModelConfig: vi.fn(),
}));

describe('createGenerationId', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('core behavior', () => {
    it('produces unique IDs on each call', () => {
      const id1 = createGenerationId();
      const id2 = createGenerationId();

      expect(id1).not.toBe(id2);
    });

    it('generates ID with gen- prefix and timestamp', () => {
      const id = createGenerationId();

      expect(id).toMatch(/^gen-1700000000000-[a-z0-9]{6}$/);
    });

    it('includes random suffix for uniqueness', () => {
      // Collect 100 IDs and verify all have unique suffixes
      const ids = Array.from({ length: 100 }, () => createGenerationId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });
  });
});

describe('resolveGenerationOptions', () => {
  describe('edge cases', () => {
    it('returns default null values when no params provided', () => {
      const result = resolveGenerationOptions(undefined, undefined);

      expect(result).toEqual({
        promptVersionId: null,
        aspectRatio: null,
        duration: null,
        fps: null,
        generationParams: undefined,
        startImage: null,
        characterAssetId: null,
        faceSwapUrl: null,
        faceSwapAlreadyApplied: undefined,
      });
    });

    it('treats null and undefined as fallthrough values with nullish coalescing', () => {
      const base: GenerationParams = { aspectRatio: '16:9' };
      const overrides: GenerationParams = { aspectRatio: null };

      const result = resolveGenerationOptions(base, overrides);

      // null in overrides falls through to base due to ?? operator
      expect(result.aspectRatio).toBe('16:9');
    });

    it('preserves nested startImage structure', () => {
      const base: GenerationParams = {
        startImage: {
          url: 'https://example.com/image.jpg',
          assetId: 'asset-1',
          source: 'upload',
        },
      };

      const result = resolveGenerationOptions(base, undefined);

      expect(result.startImage).toEqual({
        url: 'https://example.com/image.jpg',
        assetId: 'asset-1',
        source: 'upload',
      });
    });
  });

  describe('core behavior', () => {
    it('overrides use base values when override is undefined', () => {
      const base: GenerationParams = {
        promptVersionId: 'v1',
        aspectRatio: '16:9',
        duration: 5,
        fps: 24,
      };

      const result = resolveGenerationOptions(base, {});

      expect(result.promptVersionId).toBe('v1');
      expect(result.aspectRatio).toBe('16:9');
      expect(result.duration).toBe(5);
      expect(result.fps).toBe(24);
    });

    it('prefers override values over base values', () => {
      const base: GenerationParams = {
        aspectRatio: '16:9',
        duration: 5,
      };
      const overrides: GenerationParams = {
        aspectRatio: '9:16',
        duration: 10,
      };

      const result = resolveGenerationOptions(base, overrides);

      expect(result.aspectRatio).toBe('9:16');
      expect(result.duration).toBe(10);
    });

    it('merges generationParams from overrides', () => {
      const base: GenerationParams = {
        generationParams: { seed: 123 },
      };
      const overrides: GenerationParams = {
        generationParams: { seed: 456, motion: 'slow' },
      };

      const result = resolveGenerationOptions(base, overrides);

      // Override replaces entirely, not merges
      expect(result.generationParams).toEqual({ seed: 456, motion: 'slow' });
    });
  });
});

describe('buildGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('edge cases', () => {
    it('uses null for estimatedCost when model config not found', () => {
      vi.mocked(getModelConfig).mockReturnValue(null);

      const result = buildGeneration('draft', 'unknown-model', 'test prompt', {});

      expect(result.estimatedCost).toBeNull();
      expect(result.mediaType).toBe('video'); // Falls back to 'video'
    });

    it('handles params with all null values', () => {
      vi.mocked(getModelConfig).mockReturnValue({
        label: 'Test',
        credits: 10,
        eta: '30s',
        mediaType: 'video',
      });

      const params: GenerationParams = {
        promptVersionId: null,
        aspectRatio: null,
        duration: null,
        fps: null,
        startImage: null,
      };

      const result = buildGeneration('render', 'sora-2', 'prompt', params);

      expect(result.promptVersionId).toBeNull();
      expect(result.aspectRatio).toBeNull();
      expect(result.duration).toBeNull();
      expect(result.fps).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('creates generation with correct initial status and timestamps', () => {
      vi.mocked(getModelConfig).mockReturnValue({
        label: 'WAN',
        credits: 5,
        eta: '45s',
        mediaType: 'video',
      });

      const result = buildGeneration('draft', 'wan-2.2', 'A cat walking', {
        promptVersionId: 'v1',
        aspectRatio: '16:9',
      });

      expect(result.status).toBe('pending');
      expect(result.createdAt).toBe(1700000000000);
      expect(result.completedAt).toBeNull();
      expect(result.error).toBeNull();
      expect(result.mediaUrls).toEqual([]);
      expect(result.thumbnailUrl).toBeNull();
      expect(result.actualCost).toBeNull();
    });

    it('uses model config for credits and mediaType', () => {
      vi.mocked(getModelConfig).mockReturnValue({
        label: 'Kontext',
        credits: 4,
        eta: '20s',
        mediaType: 'image-sequence',
        frameCount: 4,
      });

      const result = buildGeneration('draft', 'flux-kontext', 'test', {});

      expect(result.estimatedCost).toBe(4);
      expect(result.mediaType).toBe('image-sequence');
    });

    it('sets tier correctly from parameter', () => {
      vi.mocked(getModelConfig).mockReturnValue({
        label: 'Sora',
        credits: 80,
        eta: '2-4m',
        mediaType: 'video',
      });

      const draftGen = buildGeneration('draft', 'sora-2', 'prompt', {});
      const renderGen = buildGeneration('render', 'sora-2', 'prompt', {});

      expect(draftGen.tier).toBe('draft');
      expect(renderGen.tier).toBe('render');
    });

    it('copies params to generation fields', () => {
      vi.mocked(getModelConfig).mockReturnValue({
        label: 'Test',
        credits: 10,
        eta: '1m',
        mediaType: 'video',
      });

      const params: GenerationParams = {
        promptVersionId: 'version-abc',
        aspectRatio: '9:16',
        duration: 10,
        fps: 30,
      };

      const result = buildGeneration('render', 'model', 'prompt', params);

      expect(result.promptVersionId).toBe('version-abc');
      expect(result.aspectRatio).toBe('9:16');
      expect(result.duration).toBe(10);
      expect(result.fps).toBe(30);
    });

    it('generates unique ID for each generation', () => {
      vi.mocked(getModelConfig).mockReturnValue({
        label: 'Test',
        credits: 10,
        eta: '1m',
        mediaType: 'video',
      });

      const gen1 = buildGeneration('draft', 'model', 'prompt', {});
      const gen2 = buildGeneration('draft', 'model', 'prompt', {});

      expect(gen1.id).not.toBe(gen2.id);
      expect(gen1.id).toMatch(/^gen-/);
      expect(gen2.id).toMatch(/^gen-/);
    });
  });
});
