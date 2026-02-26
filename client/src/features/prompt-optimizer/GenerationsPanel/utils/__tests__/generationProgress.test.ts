import { describe, it, expect } from 'vitest';
import { getGenerationProgressPercent } from '../generationProgress';
import type { Generation } from '../../types';

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-123',
  tier: 'draft',
  status: 'pending',
  model: 'wan-2.2',
  prompt: 'A cat walking',
  promptVersionId: 'v1',
  createdAt: Date.now(),
  completedAt: null,
  mediaType: 'video',
  mediaUrls: [],
  ...overrides,
});

describe('getGenerationProgressPercent', () => {
  describe('edge cases', () => {
    it('returns 100 immediately for completed generations', () => {
      const gen = createGeneration({ status: 'completed' });

      expect(getGenerationProgressPercent(gen, Date.now())).toBe(100);
    });

    it('returns null for failed status', () => {
      const gen = createGeneration({ status: 'failed' });

      expect(getGenerationProgressPercent(gen, Date.now())).toBeNull();
    });

    it('returns 0 when generation just started (elapsed = 0)', () => {
      const now = Date.now();
      const gen = createGeneration({ createdAt: now, mediaUrls: [] });

      expect(getGenerationProgressPercent(gen, now)).toBe(0);
    });

    it('caps time-based progress at 95%', () => {
      const now = Date.now();
      // For draft tier video, expected time is 35000ms
      // At 100% of expected time, should still be capped at 95%
      const gen = createGeneration({
        tier: 'draft',
        mediaType: 'video',
        createdAt: now - 35000, // Exactly at expected time
        mediaUrls: [],
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(95);
    });

    it('handles negative elapsed time gracefully (future createdAt)', () => {
      const now = Date.now();
      const gen = createGeneration({
        createdAt: now + 10000, // Future timestamp
        mediaUrls: [],
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(0);
    });
  });

  describe('time-based progress calculations', () => {
    it('calculates progress for draft tier video (35s expected)', () => {
      const now = Date.now();
      const gen = createGeneration({
        tier: 'draft',
        mediaType: 'video',
        createdAt: now - 17500, // 50% of 35000ms
        mediaUrls: [],
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(50);
    });

    it('calculates progress for render tier video (65s expected)', () => {
      const now = Date.now();
      const gen = createGeneration({
        tier: 'render',
        mediaType: 'video',
        createdAt: now - 32500, // 50% of 65000ms
        mediaUrls: [],
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(50);
    });

    it('calculates progress for image-sequence (18s expected)', () => {
      const now = Date.now();
      const gen = createGeneration({
        mediaType: 'image-sequence',
        createdAt: now - 9000, // 50% of 18000ms
        mediaUrls: [],
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(50);
    });
  });

  describe('url-based progress calculations', () => {
    it('caps url-based progress at 99%', () => {
      const now = Date.now();
      // For image-sequence with 4 slots, having all 4 URLs gives 100% url progress
      // but should be capped at 99%
      const gen = createGeneration({
        mediaType: 'image-sequence',
        createdAt: now, // Just started, time progress = 0
        mediaUrls: ['url1', 'url2', 'url3', 'url4'],
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(99);
    });

    it('calculates partial url progress for image-sequence', () => {
      const now = Date.now();
      const gen = createGeneration({
        mediaType: 'image-sequence',
        createdAt: now, // No time progress
        mediaUrls: ['url1', 'url2'], // 2 of 4 = 50%
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(50);
    });

    it('calculates url progress for video with single slot', () => {
      const now = Date.now();
      const gen = createGeneration({
        mediaType: 'video',
        createdAt: now,
        mediaUrls: ['video-url'], // 1 of 1 = 100% but capped at 99%
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(99);
    });
  });

  describe('server progress', () => {
    it('uses serverProgress when higher than time and url progress', () => {
      const now = Date.now();
      const gen = createGeneration({
        createdAt: now, // time = 0%
        mediaUrls: [], // url = 0%
        serverProgress: 75,
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(75);
    });

    it('caps serverProgress at 99', () => {
      const now = Date.now();
      const gen = createGeneration({
        createdAt: now,
        mediaUrls: [],
        serverProgress: 100,
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(99);
    });

    it('ignores null or undefined serverProgress', () => {
      const now = Date.now();
      const gen = createGeneration({
        createdAt: now - 17500, // 50% of 35s
        mediaUrls: [],
        serverProgress: null,
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(50);
    });
  });

  describe('core behavior', () => {
    it('uses maximum of time-based, url-based, and server progress', () => {
      const now = Date.now();
      // Time progress: 9000 / 18000 = 50%
      // URL progress: 3/4 = 75%
      // Server progress: 60%
      // Should return max(50, 75, 60) = 75
      const gen = createGeneration({
        mediaType: 'image-sequence',
        createdAt: now - 9000, // 50% time
        mediaUrls: ['url1', 'url2', 'url3'], // 75% urls
        serverProgress: 60,
      });

      expect(getGenerationProgressPercent(gen, now)).toBe(75);
    });

    it('handles both pending and generating status', () => {
      const now = Date.now();
      const pendingGen = createGeneration({
        status: 'pending',
        createdAt: now - 17500,
        mediaUrls: [],
      });
      const generatingGen = createGeneration({
        status: 'generating',
        createdAt: now - 17500,
        mediaUrls: [],
      });

      // Both should calculate progress the same way
      expect(getGenerationProgressPercent(pendingGen, now)).toBe(50);
      expect(getGenerationProgressPercent(generatingGen, now)).toBe(50);
    });
  });
});
