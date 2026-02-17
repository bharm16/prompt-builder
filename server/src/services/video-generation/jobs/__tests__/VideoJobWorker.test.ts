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

vi.mock(
  '@infrastructure/Logger',
  () => ({
    logger: {
      child: () => ({
        info: mocks.loggerInfo,
        warn: mocks.loggerWarn,
        error: mocks.loggerError,
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
  claimNextJob: ReturnType<typeof vi.fn>;
  markCompleted: ReturnType<typeof vi.fn>;
  markFailed: ReturnType<typeof vi.fn>;
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
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
  ...overrides,
});

const createWorker = (
  jobStore: MinimalJobStore,
  generateVideo: ReturnType<typeof vi.fn>
) =>
  new VideoJobWorker(
    jobStore as never,
    { generateVideo } as never,
    { refundCredits: vi.fn() } as never,
    { saveFromUrl: mocks.saveFromUrl } as never,
    {
      workerId: 'worker-a',
      pollIntervalMs: 1_000,
      leaseMs: 10_000,
      maxConcurrent: 1,
    }
  );

const runProcessJob = (worker: VideoJobWorker, job: VideoJobRecord) =>
  (worker as unknown as { processJob: (record: VideoJobRecord) => Promise<void> }).processJob(job);

describe('VideoJobWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks job completed with storage metadata when generation succeeds', async () => {
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

    expect(generateVideo).toHaveBeenCalledWith('a cinematic prompt', { model: 'sora-2' });
    expect(mocks.saveFromUrl).toHaveBeenCalledWith(
      'user-1',
      'https://provider.example.com/video.mp4',
      'generation',
      {
        model: 'sora-2',
        creditsUsed: 7,
      }
    );
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
    expect(mocks.refundWithGuard).not.toHaveBeenCalled();
  });

  it('continues completion when storage persistence fails', async () => {
    const generationResult: VideoGenerationResult = {
      assetId: 'asset-1',
      videoUrl: 'https://provider.example.com/video.mp4',
      contentType: 'video/mp4',
      inputMode: 'i2v',
      startImageUrl: 'https://images.example.com/start.png',
    };
    const generateVideo = vi.fn().mockResolvedValue(generationResult);
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn().mockResolvedValue(true),
      markFailed: vi.fn(),
    };
    mocks.saveFromUrl.mockRejectedValue(new Error('storage unavailable'));

    const worker = createWorker(jobStore, generateVideo);
    await runProcessJob(worker, createJob());

    expect(jobStore.markCompleted).toHaveBeenCalledWith('job-1', generationResult);
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Failed to persist generated video to storage', {
      jobId: 'job-1',
      userId: 'user-1',
      error: 'storage unavailable',
    });
  });

  it('marks failed jobs and refunds reserved credits when generation fails', async () => {
    const generateVideo = vi.fn().mockRejectedValue(new Error('provider rate limit'));
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(true),
    };
    const worker = createWorker(jobStore, generateVideo);
    const job = createJob({ id: 'job-fail', creditsReserved: 4 });

    await runProcessJob(worker, job);

    expect(jobStore.markFailed).toHaveBeenCalledWith('job-fail', 'provider rate limit');
    expect(mocks.buildRefundKey).toHaveBeenCalledWith(['video-job', 'job-fail', 'video']);
    expect(mocks.refundWithGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 4,
        refundKey: 'refund-video-job-job-fail-video',
        reason: 'video job worker failed',
        metadata: {
          jobId: 'job-fail',
          workerId: 'worker-a',
        },
      })
    );
  });

  it('skips refund when failed status cannot be persisted', async () => {
    const generateVideo = vi.fn().mockRejectedValue(new Error('provider timeout'));
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(false),
    };
    const worker = createWorker(jobStore, generateVideo);

    await runProcessJob(worker, createJob({ id: 'job-no-refund' }));

    expect(mocks.refundWithGuard).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Video job failure skipped (status changed)', {
      jobId: 'job-no-refund',
      userId: 'user-1',
    });
  });
});
