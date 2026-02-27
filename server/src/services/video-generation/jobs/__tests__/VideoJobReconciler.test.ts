import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VideoJobReconciler } from '../VideoJobReconciler';
import type { VideoJobStore } from '../VideoJobStore';
import type { VideoJobRecord } from '../types';

function createMockFile(name: string, timeCreated: string) {
  return {
    name,
    getMetadata: vi.fn(async () => [{ timeCreated }]),
    delete: vi.fn(async () => {}),
  };
}

function createMockBucket(files: ReturnType<typeof createMockFile>[]) {
  return {
    getFiles: vi.fn(async () => [files]),
  } as unknown as import('@google-cloud/storage').Bucket;
}

function createMockJobStore(overrides: Partial<VideoJobStore> = {}): VideoJobStore {
  return {
    createJob: vi.fn(),
    getJob: vi.fn(),
    findJobByAssetId: vi.fn(async () => null),
    claimNextJob: vi.fn(),
    claimJob: vi.fn(),
    renewLease: vi.fn(),
    releaseClaim: vi.fn(),
    requeueForRetry: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    enqueueDeadLetter: vi.fn(),
    claimNextDlqEntry: vi.fn(),
    markDlqReprocessed: vi.fn(),
    markDlqFailed: vi.fn(),
    getDlqBacklogCount: vi.fn(),
    failNextQueuedStaleJob: vi.fn(),
    failNextProcessingStaleJob: vi.fn(),
    ...overrides,
  } as unknown as VideoJobStore;
}

function completedJob(assetId: string): VideoJobRecord {
  return {
    id: `job-${assetId}`,
    status: 'completed',
    userId: 'user-1',
    request: { prompt: 'test', options: {} },
    creditsReserved: 10,
    attempts: 1,
    maxAttempts: 3,
    createdAtMs: Date.now() - 7200_000,
    updatedAtMs: Date.now() - 3600_000,
    result: {
      assetId,
      videoUrl: `https://example.com/${assetId}.mp4`,
      contentType: 'video/mp4',
    },
  };
}

function failedJob(jobId: string): VideoJobRecord {
  return {
    id: jobId,
    status: 'failed',
    userId: 'user-1',
    request: { prompt: 'test', options: {} },
    creditsReserved: 10,
    attempts: 3,
    maxAttempts: 3,
    createdAtMs: Date.now() - 7200_000,
    updatedAtMs: Date.now() - 3600_000,
    error: { message: 'markCompleted failed' },
  };
}

describe('VideoJobReconciler', () => {
  const basePath = 'video-previews';
  const orphanThresholdMs = 3600_000; // 1 hour
  const oldTimestamp = new Date(Date.now() - 7200_000).toISOString(); // 2 hours ago
  const recentTimestamp = new Date(Date.now() - 600_000).toISOString(); // 10 minutes ago

  let metrics: { recordAlert: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    metrics = { recordAlert: vi.fn() };
  });

  it('takes no action when GCS object has a matching completed job', async () => {
    const files = [createMockFile('video-previews/asset-abc', oldTimestamp)];
    const bucket = createMockBucket(files);
    const jobStore = createMockJobStore({
      findJobByAssetId: vi.fn(async () => completedJob('asset-abc')),
    });

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    expect(metrics.recordAlert).not.toHaveBeenCalled();
  });

  it('logs alert for GCS object with no matching job record', async () => {
    const files = [createMockFile('video-previews/asset-orphan', oldTimestamp)];
    const bucket = createMockBucket(files);
    const jobStore = createMockJobStore({
      findJobByAssetId: vi.fn(async () => null),
    });

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    expect(metrics.recordAlert).toHaveBeenCalledWith(
      'video_reconciler_orphan_no_job',
      expect.objectContaining({
        assetId: 'asset-orphan',
        gcsPath: 'video-previews/asset-orphan',
      })
    );
  });

  it('logs alert for GCS object with a failed job (markCompleted failure scenario)', async () => {
    const files = [createMockFile('video-previews/asset-failed', oldTimestamp)];
    const bucket = createMockBucket(files);
    const jobStore = createMockJobStore({
      findJobByAssetId: vi.fn(async () => failedJob('job-failed')),
    });

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    expect(metrics.recordAlert).toHaveBeenCalledWith(
      'video_reconciler_orphan_incomplete_job',
      expect.objectContaining({
        assetId: 'asset-failed',
        jobId: 'job-failed',
        jobStatus: 'failed',
      })
    );
  });

  it('skips GCS objects newer than orphan threshold', async () => {
    const files = [createMockFile('video-previews/asset-recent', recentTimestamp)];
    const bucket = createMockBucket(files);
    const jobStore = createMockJobStore();

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    expect(jobStore.findJobByAssetId).not.toHaveBeenCalled();
    expect(metrics.recordAlert).not.toHaveBeenCalled();
  });

  it('respects maxObjectsPerRun budget', async () => {
    const files = [
      createMockFile('video-previews/asset-1', oldTimestamp),
      createMockFile('video-previews/asset-2', oldTimestamp),
      createMockFile('video-previews/asset-3', oldTimestamp),
    ];
    const bucket = createMockBucket(files);
    const jobStore = createMockJobStore({
      findJobByAssetId: vi.fn(async () => null),
    });

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      maxObjectsPerRun: 2,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    expect(jobStore.findJobByAssetId).toHaveBeenCalledTimes(2);
  });

  it('returns false and backs off on GCS listing error', async () => {
    const bucket = {
      getFiles: vi.fn(async () => {
        throw new Error('GCS unavailable');
      }),
    } as unknown as import('@google-cloud/storage').Bucket;
    const jobStore = createMockJobStore();

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(false);
  });

  it('regression: reconciler detects orphan from Finding 2 (markCompleted failure)', async () => {
    // Scenario: Video was generated and stored in GCS, but markCompleted failed.
    // The sweeper then moved the job to 'failed' status.
    // The GCS asset still exists but no completed job references it.
    const files = [createMockFile('video-previews/asset-lost', oldTimestamp)];
    const bucket = createMockBucket(files);

    // findJobByAssetId queries result.assetId — which only exists on completed jobs.
    // Since this job failed before markCompleted, it returns null.
    const jobStore = createMockJobStore({
      findJobByAssetId: vi.fn(async () => null),
    });

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    expect(metrics.recordAlert).toHaveBeenCalledWith(
      'video_reconciler_orphan_no_job',
      expect.objectContaining({
        assetId: 'asset-lost',
        gcsPath: 'video-previews/asset-lost',
      })
    );
  });

  it('handles mixed old and new files correctly', async () => {
    const files = [
      createMockFile('video-previews/old-orphan', oldTimestamp),
      createMockFile('video-previews/recent-ok', recentTimestamp),
      createMockFile('video-previews/old-matched', oldTimestamp),
    ];
    const bucket = createMockBucket(files);
    const jobStore = createMockJobStore({
      findJobByAssetId: vi.fn(async (assetId: string) => {
        if (assetId === 'old-matched') return completedJob('old-matched');
        return null;
      }),
    });

    const reconciler = new VideoJobReconciler(bucket, basePath, jobStore, {
      orphanThresholdMs,
      metrics,
    });

    const success = await reconciler.runOnce();
    expect(success).toBe(true);
    // Only old-orphan should be flagged
    expect(metrics.recordAlert).toHaveBeenCalledTimes(1);
    expect(metrics.recordAlert).toHaveBeenCalledWith(
      'video_reconciler_orphan_no_job',
      expect.objectContaining({ assetId: 'old-orphan' })
    );
  });
});
