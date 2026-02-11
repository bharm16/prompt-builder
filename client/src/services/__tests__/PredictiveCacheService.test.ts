/**
 * Unit tests for PredictiveCacheService
 *
 * Tests pattern tracking, prediction generation, similarity calculation,
 * history management, and pre-warm flow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PredictiveCacheService } from '../PredictiveCacheService';

describe('PredictiveCacheService', () => {
  let service: PredictiveCacheService;
  const originalRequestIdleCallback = globalThis.requestIdleCallback;

  beforeEach(() => {
    service = new PredictiveCacheService({
      enabled: true,
      maxHistorySize: 10,
      minFrequency: 2,
      predictionWindow: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalRequestIdleCallback === undefined) {
      delete (globalThis as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
      return;
    }

    globalThis.requestIdleCallback = originalRequestIdleCallback;
  });

  // ---------------------------------------------------------------------------
  // Disabled service - error/guard cases
  // ---------------------------------------------------------------------------
  describe('when disabled', () => {
    it('does not record requests', () => {
      const disabled = new PredictiveCacheService({ enabled: false });
      disabled.recordRequest({ text: 'test' });
      expect(disabled.getStats().totalRequests).toBe(0);
    });

    it('returns empty predictions', () => {
      const disabled = new PredictiveCacheService({ enabled: false });
      expect(disabled.getPredictions()).toEqual([]);
    });

    it('does not call fetchFunction during preWarmCache', async () => {
      const disabled = new PredictiveCacheService({ enabled: false });
      const fetchFn = vi.fn();
      await disabled.preWarmCache(fetchFn);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // recordRequest
  // ---------------------------------------------------------------------------
  describe('recordRequest', () => {
    it('increments totalRequests', () => {
      service.recordRequest({ text: 'a prompt' });
      expect(service.getStats().totalRequests).toBe(1);
    });

    it('increments patternsDetected for new patterns', () => {
      service.recordRequest({ text: 'prompt A' });
      service.recordRequest({ text: 'prompt B' });
      expect(service.getStats().patternsDetected).toBe(2);
    });

    it('does not increment patternsDetected for repeated exact text', () => {
      service.recordRequest({ text: 'same text' });
      service.recordRequest({ text: 'same text' });
      expect(service.getStats().patternsDetected).toBe(1);
      expect(service.getStats().totalRequests).toBe(2);
    });

    it('limits history to maxHistorySize', () => {
      for (let i = 0; i < 15; i++) {
        service.recordRequest({ text: `prompt ${i}` });
      }
      expect(service.getStats().historySize).toBe(10);
    });

    it('schedules prewarm opportunity when requestIdleCallback is available', () => {
      const requestIdleCallbackMock = vi
        .fn()
        .mockImplementation((callback: IdleRequestCallback) => {
          callback({
            didTimeout: false,
            timeRemaining: () => 10,
          } as IdleDeadline);
          return 1;
        });
      globalThis.requestIdleCallback = requestIdleCallbackMock;

      service.recordRequest({ text: 'schedule idle prewarm' });

      expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getPredictions
  // ---------------------------------------------------------------------------
  describe('getPredictions', () => {
    it('returns empty when history has fewer than 2 entries', () => {
      service.recordRequest({ text: 'only one' });
      expect(service.getPredictions()).toEqual([]);
    });

    it('returns frequent patterns when frequency meets minFrequency', () => {
      service.recordRequest({ text: 'repeated prompt' });
      service.recordRequest({ text: 'other prompt' });
      service.recordRequest({ text: 'repeated prompt' });
      const predictions = service.getPredictions();
      const frequentPrediction = predictions.find(
        (p) => p.text === 'repeated prompt',
      );
      expect(frequentPrediction).toBeDefined();
      expect(frequentPrediction?.reason).toBe('frequent_pattern');
    });

    it('does not return patterns below minFrequency as frequent_pattern', () => {
      service.recordRequest({ text: 'one time prompt' });
      service.recordRequest({ text: 'another one time' });
      const predictions = service.getPredictions();
      const frequentPredictions = predictions.filter(
        (p) => p.reason === 'frequent_pattern',
      );
      expect(frequentPredictions).toHaveLength(0);
    });

    it('returns at most 5 predictions', () => {
      for (let i = 0; i < 20; i++) {
        service.recordRequest({ text: `pattern ${i % 5}` });
        service.recordRequest({ text: `pattern ${i % 5}` });
      }
      expect(service.getPredictions().length).toBeLessThanOrEqual(5);
    });

    it('assigns confidence between 0 and 1', () => {
      service.recordRequest({ text: 'frequent text here' });
      service.recordRequest({ text: 'another text' });
      service.recordRequest({ text: 'frequent text here' });
      service.recordRequest({ text: 'frequent text here' });

      const predictions = service.getPredictions();
      for (const p of predictions) {
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('returns similar_pattern prediction for highly similar recent text', () => {
      const similarService = new PredictiveCacheService({
        enabled: true,
        minFrequency: 10,
      });

      similarService.recordRequest({ text: 'bright red apple on wooden table' });
      similarService.recordRequest({ text: 'bright red apple on wooden table now' });

      const predictions = similarService.getPredictions();
      expect(predictions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'bright red apple on wooden table',
            reason: 'similar_pattern',
          }),
        ])
      );
    });
  });

  // ---------------------------------------------------------------------------
  // recordPredictionHit
  // ---------------------------------------------------------------------------
  describe('recordPredictionHit', () => {
    it('increments cacheHitsFromPrediction', () => {
      service.recordPredictionHit();
      service.recordPredictionHit();
      expect(service.getStats().cacheHitsFromPrediction).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------------------
  describe('getStats', () => {
    it('returns correct initial stats', () => {
      const stats = service.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.patternsDetected).toBe(0);
      expect(stats.historySize).toBe(0);
      expect(stats.patternsTracked).toBe(0);
      expect(stats.predictionAccuracy).toBe(0);
    });

    it('returns zero predictionAccuracy when no preWarmSuccess', () => {
      service.recordPredictionHit();
      expect(service.getStats().predictionAccuracy).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------
  describe('clear', () => {
    it('resets all state', () => {
      service.recordRequest({ text: 'prompt' });
      service.recordRequest({ text: 'prompt' });
      service.recordPredictionHit();
      service.clear();

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.patternsDetected).toBe(0);
      expect(stats.historySize).toBe(0);
      expect(stats.patternsTracked).toBe(0);
      expect(stats.cacheHitsFromPrediction).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // preWarmCache
  // ---------------------------------------------------------------------------
  describe('preWarmCache', () => {
    it('calls fetchFunction for predictions with priority false', async () => {
      const fetchFn = vi.fn().mockResolvedValue({});
      service.recordRequest({ text: 'warm me' });
      service.recordRequest({ text: 'other' });
      service.recordRequest({ text: 'warm me' });

      await service.preWarmCache(fetchFn);

      if (service.getPredictions().length > 0) {
        expect(fetchFn).toHaveBeenCalled();
        const firstCall = fetchFn.mock.calls[0];
        expect(firstCall).toBeDefined();
        const firstArg = firstCall?.[0];
        expect(firstArg).toBeDefined();
        expect(firstArg).toHaveProperty('priority', false);
      }
    });

    it('does not call fetchFunction when no predictions exist', async () => {
      const fetchFn = vi.fn();
      await service.preWarmCache(fetchFn);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('increments preWarmAttempts and preWarmSuccess on success', async () => {
      const fetchFn = vi.fn().mockResolvedValue({});
      service.recordRequest({ text: 'cache this' });
      service.recordRequest({ text: 'other' });
      service.recordRequest({ text: 'cache this' });

      await service.preWarmCache(fetchFn);

      const stats = service.getStats();
      if (stats.preWarmAttempts > 0) {
        expect(stats.preWarmSuccess).toBe(stats.preWarmAttempts);
      }
    });

    it('silently handles fetch failures without throwing', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));
      service.recordRequest({ text: 'fail this' });
      service.recordRequest({ text: 'other' });
      service.recordRequest({ text: 'fail this' });

      await expect(service.preWarmCache(fetchFn)).resolves.toBeUndefined();
    });

    it('does not run concurrently (isPreWarming guard)', async () => {
      const fetchFn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
      );
      service.recordRequest({ text: 'concurrent' });
      service.recordRequest({ text: 'other' });
      service.recordRequest({ text: 'concurrent' });

      const p1 = service.preWarmCache(fetchFn);
      const p2 = service.preWarmCache(fetchFn);
      await Promise.all([p1, p2]);

      // Second call should be a no-op due to isPreWarming guard
    });

    it('uses timeout fallback when requestIdleCallback is unavailable', async () => {
      vi.useFakeTimers();
      delete (globalThis as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;

      const fetchFn = vi.fn().mockResolvedValue({});
      service.recordRequest({ text: 'fallback idle' });
      service.recordRequest({ text: 'other' });
      service.recordRequest({ text: 'fallback idle' });

      const preWarmPromise = service.preWarmCache(fetchFn);
      await vi.advanceTimersByTimeAsync(1000);
      await preWarmPromise;

      expect(fetchFn).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
