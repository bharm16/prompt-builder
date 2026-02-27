import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoGenerationResult } from '@services/video-generation/types';
import type { VideoJobRecord } from '../types';
import { VideoJobWorker } from '../VideoJobWorker';

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  buildRefundKey: vi.fn((parts: Array<string | number>) => `refund-${parts.join('-')}`),
  refundWithGuard: vi.fn().mockResolvedValue(true),
  saveFromUrl: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      info: mocks.loggerInfo,
      warn: mocks.loggerWarn,
      error: mocks.loggerError,
      debug: vi.fn(),
    }),
  },
}));

vi.mock('@services/credits/refundGuard', () => ({
  buildRefundKey: mocks.buildRefundKey,
  refundWithGuard: mocks.refundWithGuard,
}));

// Inline RetryPolicy mock — no sleep delays, pure retry logic
vi.mock('@server/utils/RetryPolicy', () => ({
  RetryPolicy: {
    execute: async <T>(fn: () => Promise<T>, options?: { maxRetries?: number }): Promise<T> => {
      const maxRetries = options?.maxRetries ?? 2;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
      throw lastError;
    },
  },
}));

type MinimalJobStore = {
  claimNextJob: ReturnType<typeof vi.fn>;
  markCompleted: ReturnType<typeof vi.fn>;
  markFailed: ReturnType<typeof vi.fn>;
  requeueForRetry: ReturnType<typeof vi.fn>;
  enqueueDeadLetter: ReturnType<typeof vi.fn>;
  releaseClaim: ReturnType<typeof vi.fn>;
  renewLease: ReturnType<typeof vi.fn>;
};

const createJob = (overrides?: Partial<VideoJobRecord>): VideoJobRecord => ({
  id: 'job-1',
  status: 'processing',
  userId: 'user-1',
  request: {
    prompt: 'a cinematic prompt',
    options: { model: 'sora-2' },
  },
  creditsReserved: 7,
  attempts: 1,
  maxAttempts: 3,
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
  ...overrides,
});

const createWorker = (jobStore: MinimalJobStore, generateVideo: ReturnType<typeof vi.fn>) =>
  new VideoJobWorker(
    jobStore as never,
    { generateVideo } as never,
    { refundCredits: vi.fn() } as never,
    { saveFromUrl: mocks.saveFromUrl } as never,
    {
      workerId: 'worker-a',
      pollIntervalMs: 1_000,
      leaseMs: 60_000,
      maxConcurrent: 1,
      heartbeatIntervalMs: 10_000,
    }
  );

const runProcessJob = (worker: VideoJobWorker, job: VideoJobRecord) =>
  (worker as unknown as { processJob: (record: VideoJobRecord) => Promise<void> }).processJob(job);

describe('VideoJobWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks job completed with required storage metadata when generation succeeds', async () => {
    const generationResult: VideoGenerationResult = {
      assetId: 'asset-1',
      videoUrl: 'https://provider.example.com/video.mp4',
      contentType: 'video/mp4',
      inputMode: 't2v',
    };
    const generateVideo = vi.fn().mockResolvedValue(generationResult);
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn().mockResolvedValue(true),
      markFailed: vi.fn(),
      requeueForRetry: vi.fn(),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(true),
      renewLease: vi.fn().mockResolvedValue(true),
    };
    mocks.saveFromUrl.mockResolvedValue({
      storagePath: 'users/user-1/generation/video.mp4',
      viewUrl: 'https://cdn.example.com/view/video.mp4',
      expiresAt: '2026-02-11T00:00:00.000Z',
      sizeBytes: 987,
      contentType: 'video/mp4',
      createdAt: '2026-02-11T00:00:00.000Z',
    });

    const worker = createWorker(jobStore, generateVideo);
    await runProcessJob(worker, createJob());

    expect(jobStore.markCompleted).toHaveBeenCalledWith('job-1', {
      assetId: 'asset-1',
      videoUrl: 'https://provider.example.com/video.mp4',
      contentType: 'video/mp4',
      inputMode: 't2v',
      storagePath: 'users/user-1/generation/video.mp4',
      viewUrl: 'https://cdn.example.com/view/video.mp4',
      viewUrlExpiresAt: '2026-02-11T00:00:00.000Z',
      sizeBytes: 987,
    });
    expect(jobStore.markFailed).not.toHaveBeenCalled();
    expect(jobStore.requeueForRetry).not.toHaveBeenCalled();
    expect(mocks.refundWithGuard).not.toHaveBeenCalled();
  });

  it('requeues retryable failures while attempts remain', async () => {
    const generateVideo = vi.fn().mockRejectedValue(new Error('provider timeout'));
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      requeueForRetry: vi.fn().mockResolvedValue(true),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(true),
      renewLease: vi.fn().mockResolvedValue(true),
    };

    const worker = createWorker(jobStore, generateVideo);
    await runProcessJob(worker, createJob({ attempts: 1, maxAttempts: 3 }));

    expect(jobStore.requeueForRetry).toHaveBeenCalledWith(
      'job-1',
      'worker-a',
      expect.objectContaining({
        retryable: true,
        stage: 'generation',
        category: 'timeout',
        attempt: 1,
      })
    );
    expect(jobStore.markFailed).not.toHaveBeenCalled();
    expect(mocks.refundWithGuard).not.toHaveBeenCalled();
  });

  it('marks terminal failures, enqueues DLQ, and refunds credits when attempts are exhausted', async () => {
    const generateVideo = vi.fn().mockRejectedValue(new Error('provider timeout'));
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(true),
      requeueForRetry: vi.fn(),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(true),
      renewLease: vi.fn().mockResolvedValue(true),
    };
    const worker = createWorker(jobStore, generateVideo);
    const job = createJob({ id: 'job-fail', attempts: 3, maxAttempts: 3, creditsReserved: 4 });

    await runProcessJob(worker, job);

    expect(jobStore.markFailed).toHaveBeenCalledWith(
      'job-fail',
      expect.objectContaining({
        retryable: false,
        category: 'timeout',
        stage: 'generation',
        attempt: 3,
      })
    );
    expect(jobStore.enqueueDeadLetter).toHaveBeenCalledWith(
      job,
      expect.objectContaining({
        retryable: false,
      }),
      'worker-terminal'
    );
    expect(mocks.refundWithGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 4,
        reason: 'video job worker failed',
      })
    );
  });

  it('does not retry validation failures', async () => {
    const generateVideo = vi.fn().mockRejectedValue(new Error('invalid prompt payload'));
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(true),
      requeueForRetry: vi.fn().mockResolvedValue(true),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(true),
      renewLease: vi.fn().mockResolvedValue(true),
    };

    const worker = createWorker(jobStore, generateVideo);
    await runProcessJob(worker, createJob({ attempts: 1, maxAttempts: 3 }));

    expect(jobStore.requeueForRetry).not.toHaveBeenCalled();
    expect(jobStore.markFailed).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        category: 'validation',
        retryable: false,
      })
    );
  });

  describe('markCompleted retry + refund (Finding 2)', () => {
    const storagePayload = {
      storagePath: 'users/user-1/generation/video.mp4',
      viewUrl: 'https://cdn.example.com/view/video.mp4',
      expiresAt: '2026-02-11T00:00:00.000Z',
      sizeBytes: 987,
      contentType: 'video/mp4',
      createdAt: '2026-02-11T00:00:00.000Z',
    };
    const generationResult: VideoGenerationResult = {
      assetId: 'asset-1',
      videoUrl: 'https://provider.example.com/video.mp4',
      contentType: 'video/mp4',
      inputMode: 't2v',
    };

    async function runRetryTest(
      jobStore: MinimalJobStore,
      generateVideo: ReturnType<typeof vi.fn>,
      job?: VideoJobRecord
    ): Promise<void> {
      mocks.saveFromUrl.mockResolvedValue(storagePayload);
      const worker = createWorker(jobStore, generateVideo);
      await runProcessJob(worker, job ?? createJob());
    }

    it('regression: markCompleted failure refunds credits', async () => {
      const generateVideo = vi.fn().mockResolvedValue(generationResult);
      const jobStore: MinimalJobStore = {
        claimNextJob: vi.fn(),
        markCompleted: vi.fn().mockRejectedValue(new Error('Firestore transaction failed')),
        markFailed: vi.fn(),
        requeueForRetry: vi.fn(),
        enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
        releaseClaim: vi.fn().mockResolvedValue(true),
        renewLease: vi.fn().mockResolvedValue(true),
      };

      await runRetryTest(jobStore, generateVideo);

      // RetryPolicy attempts markCompleted multiple times
      expect(jobStore.markCompleted.mock.calls.length).toBeGreaterThanOrEqual(2);
      // Credits refunded because video exists in GCS but job not marked completed
      expect(mocks.refundWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 7,
          reason: 'video job markCompleted failed after retries',
        })
      );
    });

    it('markCompleted returning false triggers refund with storage path for recovery', async () => {
      const generateVideo = vi.fn().mockResolvedValue(generationResult);
      const jobStore: MinimalJobStore = {
        claimNextJob: vi.fn(),
        markCompleted: vi.fn().mockResolvedValue(false),
        markFailed: vi.fn(),
        requeueForRetry: vi.fn(),
        enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
        releaseClaim: vi.fn().mockResolvedValue(true),
        renewLease: vi.fn().mockResolvedValue(true),
      };

      await runRetryTest(jobStore, generateVideo);

      expect(mocks.refundWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 7,
          metadata: expect.objectContaining({
            storagePath: 'users/user-1/generation/video.mp4',
          }),
        })
      );
      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Video job completion failed — refunding credits',
        undefined,
        expect.objectContaining({
          storagePath: 'users/user-1/generation/video.mp4',
          recovery: 'manual — asset exists at storagePath',
        })
      );
    });

    it('markCompleted succeeds on retry after Firestore transient error', async () => {
      const generateVideo = vi.fn().mockResolvedValue(generationResult);
      const jobStore: MinimalJobStore = {
        claimNextJob: vi.fn(),
        markCompleted: vi.fn()
          .mockRejectedValueOnce(new Error('Firestore transient error'))
          .mockResolvedValueOnce(true),
        markFailed: vi.fn(),
        requeueForRetry: vi.fn(),
        enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
        releaseClaim: vi.fn().mockResolvedValue(true),
        renewLease: vi.fn().mockResolvedValue(true),
      };

      await runRetryTest(jobStore, generateVideo);

      // Retried and succeeded — no refund
      expect(jobStore.markCompleted).toHaveBeenCalledTimes(2);
      expect(mocks.refundWithGuard).not.toHaveBeenCalled();
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        'Video job completed',
        expect.objectContaining({ jobId: 'job-1' })
      );
    });
  });

  it('releases active jobs when shutdown drain timeout is exceeded', async () => {
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      requeueForRetry: vi.fn(),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(true),
      renewLease: vi.fn().mockResolvedValue(true),
    };
    const worker = createWorker(jobStore, vi.fn());

    let released = false;
    const internals = worker as unknown as {
      activeCount: number;
      activeJobs: Map<string, { release: () => Promise<void>; startedAtMs: number }>;
    };
    internals.activeCount = 1;
    internals.activeJobs.set('job-1', {
      startedAtMs: Date.now(),
      release: async () => {
        released = true;
      },
    });

    await worker.shutdown(10);
    expect(released).toBe(true);
  });
});
