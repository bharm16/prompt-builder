import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoJobRecord } from '../types';
import { VideoJobSweeper, createVideoJobSweeper } from '../VideoJobSweeper';

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  buildRefundKey: vi.fn((parts: Array<string | number>) => `refund-${parts.join('-')}`),
  refundWithGuard: vi.fn().mockResolvedValue(true),
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

vi.mock(
  '@services/credits/refundGuard',
  () => ({
    buildRefundKey: mocks.buildRefundKey,
    refundWithGuard: mocks.refundWithGuard,
  })
);

type MinimalJobStore = {
  failNextQueuedStaleJob: ReturnType<typeof vi.fn>;
  failNextProcessingStaleJob: ReturnType<typeof vi.fn>;
  enqueueDeadLetter: ReturnType<typeof vi.fn>;
};

const createJob = (id: string, creditsReserved: number): VideoJobRecord => ({
  id,
  status: 'queued',
  userId: 'user-1',
  request: {
    prompt: 'prompt',
    options: {},
  },
  creditsReserved,
  attempts: 1,
  maxAttempts: 3,
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
});

const getRunOnce = (sweeper: VideoJobSweeper) =>
  (sweeper as unknown as { runOnce: () => Promise<boolean> }).runOnce.bind(sweeper);

describe('VideoJobSweeper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it('fails stale queued and processing jobs and refunds reserved credits', async () => {
    const jobStore: MinimalJobStore = {
      failNextQueuedStaleJob: vi
        .fn()
        .mockResolvedValueOnce(createJob('queued-1', 6))
        .mockResolvedValueOnce(null),
      failNextProcessingStaleJob: vi
        .fn()
        .mockResolvedValueOnce(createJob('processing-1', 3))
        .mockResolvedValueOnce(null),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
    };
    const userCreditService = { refundCredits: vi.fn() };
    const sweeper = new VideoJobSweeper(jobStore as never, userCreditService as never, {
      queueTimeoutMs: 10_000,
      processingGraceMs: 20_000,
      sweepIntervalMs: 1_000,
      maxJobsPerRun: 5,
    });

    await getRunOnce(sweeper)();

    expect(jobStore.failNextQueuedStaleJob).toHaveBeenCalled();
    expect(jobStore.failNextProcessingStaleJob).toHaveBeenCalled();
    expect(jobStore.enqueueDeadLetter).toHaveBeenCalledTimes(2);
    expect(mocks.buildRefundKey).toHaveBeenNthCalledWith(1, ['video-job', 'queued-1', 'video']);
    expect(mocks.buildRefundKey).toHaveBeenNthCalledWith(2, ['video-job', 'processing-1', 'video']);
    expect(mocks.refundWithGuard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'user-1',
        amount: 6,
        refundKey: 'refund-video-job-queued-1-video',
        reason: 'video job sweeper stale timeout',
      })
    );
    expect(mocks.refundWithGuard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'user-1',
        amount: 3,
        refundKey: 'refund-video-job-processing-1-video',
        reason: 'video job sweeper stale timeout',
      })
    );
  });

  it('skips refund calls for stale jobs with zero reserved credits', async () => {
    const jobStore: MinimalJobStore = {
      failNextQueuedStaleJob: vi.fn().mockResolvedValueOnce(createJob('queued-1', 0)).mockResolvedValueOnce(null),
      failNextProcessingStaleJob: vi.fn().mockResolvedValueOnce(null),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
    };
    const sweeper = new VideoJobSweeper(jobStore as never, { refundCredits: vi.fn() } as never, {
      queueTimeoutMs: 10_000,
      processingGraceMs: 20_000,
      sweepIntervalMs: 1_000,
      maxJobsPerRun: 5,
    });

    await getRunOnce(sweeper)();

    expect(mocks.refundWithGuard).not.toHaveBeenCalled();
  });

  it('swallows sweep errors and logs warning', async () => {
    const jobStore: MinimalJobStore = {
      failNextQueuedStaleJob: vi.fn().mockRejectedValue(new Error('query failed')),
      failNextProcessingStaleJob: vi.fn().mockResolvedValue(null),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
    };
    const sweeper = new VideoJobSweeper(jobStore as never, { refundCredits: vi.fn() } as never, {
      queueTimeoutMs: 10_000,
      processingGraceMs: 20_000,
      sweepIntervalMs: 1_000,
      maxJobsPerRun: 5,
    });

    await expect(getRunOnce(sweeper)()).resolves.toBe(false);
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Failed to sweep stale video jobs', {
      error: 'query failed',
    });
  });

  it('start schedules immediate and interval sweeps and stop cancels scheduling', async () => {
    vi.useFakeTimers();
    const jobStore: MinimalJobStore = {
      failNextQueuedStaleJob: vi.fn().mockResolvedValue(null),
      failNextProcessingStaleJob: vi.fn().mockResolvedValue(null),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
    };
    const sweeper = new VideoJobSweeper(jobStore as never, { refundCredits: vi.fn() } as never, {
      queueTimeoutMs: 10_000,
      processingGraceMs: 20_000,
      sweepIntervalMs: 1_000,
      maxJobsPerRun: 5,
    });
    const runOnceSpy = vi.spyOn(sweeper as never, 'runOnce').mockResolvedValue(true);

    sweeper.start();
    sweeper.start();
    expect(runOnceSpy).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runOnceSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(runOnceSpy).toHaveBeenCalledTimes(3);

    sweeper.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runOnceSpy).toHaveBeenCalledTimes(3);
  });

  it('factory returns null when disabled or invalid env and returns instance for valid env', () => {
    const jobStore = {
      failNextQueuedStaleJob: vi.fn(),
      failNextProcessingStaleJob: vi.fn(),
      enqueueDeadLetter: vi.fn(),
    };
    const userCreditService = { refundCredits: vi.fn() };

    process.env.VIDEO_JOB_SWEEPER_DISABLED = 'true';
    expect(createVideoJobSweeper(jobStore as never, userCreditService as never)).toBeNull();

    process.env.VIDEO_JOB_SWEEPER_DISABLED = 'false';
    process.env.VIDEO_JOB_SWEEP_INTERVAL_SECONDS = '0';
    expect(createVideoJobSweeper(jobStore as never, userCreditService as never)).toBeNull();

    process.env.VIDEO_JOB_STALE_QUEUE_SECONDS = '300';
    process.env.VIDEO_JOB_STALE_PROCESSING_SECONDS = '90';
    process.env.VIDEO_JOB_SWEEP_INTERVAL_SECONDS = '20';
    process.env.VIDEO_JOB_SWEEP_MAX = '10';
    expect(createVideoJobSweeper(jobStore as never, userCreditService as never)).toBeInstanceOf(
      VideoJobSweeper
    );
  });
});
