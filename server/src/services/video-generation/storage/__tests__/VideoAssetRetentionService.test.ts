import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VideoAssetRetentionService,
  createVideoAssetRetentionService,
} from '../VideoAssetRetentionService';
import type { VideoAssetStore } from '../types';

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock(
  '@infrastructure/Logger',
  () => ({
    logger: {
      child: () => ({
        info: mocks.loggerInfo,
        warn: mocks.loggerWarn,
      }),
    },
  })
);

const createStore = (cleanupExpired = vi.fn<VideoAssetStore['cleanupExpired']>()) =>
  ({
    storeFromBuffer: vi.fn(),
    storeFromStream: vi.fn(),
    getStream: vi.fn(),
    getPublicUrl: vi.fn(),
    cleanupExpired,
  }) as unknown as VideoAssetStore;

describe('VideoAssetRetentionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runOnce computes cutoff and logs cleanup count when assets are deleted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'));
    const cleanupExpired = vi.fn<VideoAssetStore['cleanupExpired']>().mockResolvedValue(3);
    const store = createStore(cleanupExpired);
    const service = new VideoAssetRetentionService(store, {
      maxAgeMs: 3_600_000,
      cleanupIntervalMs: 60_000,
      batchSize: 25,
    });

    await service.runOnce();

    expect(cleanupExpired).toHaveBeenCalledWith(Date.now() - 3_600_000, 25);
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Expired video assets cleaned up', {
      deleted: 3,
      cutoffMs: Date.now() - 3_600_000,
    });
  });

  it('runOnce swallows cleanup errors and logs warning', async () => {
    const cleanupExpired = vi
      .fn<VideoAssetStore['cleanupExpired']>()
      .mockRejectedValue(new Error('retention backend unavailable'));
    const store = createStore(cleanupExpired);
    const service = new VideoAssetRetentionService(store, {
      maxAgeMs: 3_600_000,
      cleanupIntervalMs: 60_000,
      batchSize: 25,
    });

    await expect(service.runOnce()).resolves.toBeUndefined();
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Failed to cleanup expired video assets', {
      error: 'retention backend unavailable',
    });
  });

  it('runOnce prevents overlapping cleanup runs', async () => {
    let resolveCleanup: ((value: number) => void) | undefined;
    const cleanupExpired = vi.fn<VideoAssetStore['cleanupExpired']>(
      () => new Promise<number>((resolve) => { resolveCleanup = resolve; })
    );
    const store = createStore(cleanupExpired);
    const service = new VideoAssetRetentionService(store, {
      maxAgeMs: 3_600_000,
      cleanupIntervalMs: 60_000,
      batchSize: 25,
    });

    const first = service.runOnce();
    const second = service.runOnce();
    expect(cleanupExpired).toHaveBeenCalledTimes(1);

    resolveCleanup?.(0);
    await first;
    await second;
  });

  it('start runs immediately and on interval, and stop cancels future runs', async () => {
    vi.useFakeTimers();
    const cleanupExpired = vi.fn<VideoAssetStore['cleanupExpired']>().mockResolvedValue(0);
    const store = createStore(cleanupExpired);
    const service = new VideoAssetRetentionService(store, {
      maxAgeMs: 3_600_000,
      cleanupIntervalMs: 1_000,
      batchSize: 10,
    });
    const runOnceSpy = vi.spyOn(service, 'runOnce');

    service.start();
    expect(runOnceSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_100);
    expect(runOnceSpy).toHaveBeenCalledTimes(3);

    service.start();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(runOnceSpy).toHaveBeenCalledTimes(4);

    service.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runOnceSpy).toHaveBeenCalledTimes(4);
  });

  it('does not start when maxAgeMs is disabled', () => {
    vi.useFakeTimers();
    const cleanupExpired = vi.fn<VideoAssetStore['cleanupExpired']>().mockResolvedValue(0);
    const store = createStore(cleanupExpired);
    const service = new VideoAssetRetentionService(store, {
      maxAgeMs: 0,
      cleanupIntervalMs: 1_000,
      batchSize: 10,
    });

    service.start();
    void vi.advanceTimersByTimeAsync(1_500);

    expect(cleanupExpired).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Video asset retention disabled (maxAgeMs <= 0)');
  });

  it('factory returns null for disabled or invalid interval and builds service for valid config', () => {
    const store = createStore();

    expect(
      createVideoAssetRetentionService(store, {
        disabled: true,
        retentionHours: 24,
        cleanupIntervalMinutes: 15,
        batchSize: 100,
      })
    ).toBeNull();

    expect(
      createVideoAssetRetentionService(store, {
        disabled: false,
        retentionHours: 24,
        cleanupIntervalMinutes: 0,
        batchSize: 100,
      })
    ).toBeNull();

    const service = createVideoAssetRetentionService(store, {
      disabled: false,
      retentionHours: 12,
      cleanupIntervalMinutes: 5,
      batchSize: 44,
    });
    expect(service).toBeInstanceOf(VideoAssetRetentionService);
  });
});
