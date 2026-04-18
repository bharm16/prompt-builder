import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoJobRecord } from "../types";
import { VideoJobWorker } from "../VideoJobWorker";

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock("@services/credits/refundGuard", () => ({
  buildRefundKey: (parts: Array<string | number>) =>
    `refund-${parts.join("-")}`,
  refundWithGuard: vi.fn().mockResolvedValue(true),
}));

vi.mock("@server/utils/RetryPolicy", () => ({
  RetryPolicy: {
    execute: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
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
  id: "job-drain-1",
  status: "processing",
  userId: "user-1",
  request: {
    prompt: "a cinematic prompt",
    options: { model: "sora-2" },
  },
  creditsReserved: 7,
  attempts: 1,
  maxAttempts: 3,
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
  ...overrides,
});

type ActiveJobEntry = { startedAtMs: number; release: () => Promise<void> };

const getActiveJobRelease = (
  worker: VideoJobWorker,
  jobId: string,
): (() => Promise<void>) => {
  const internal = worker as unknown as {
    activeJobs: Map<string, ActiveJobEntry>;
  };
  const entry = internal.activeJobs.get(jobId);
  if (!entry) throw new Error(`no active job entry for ${jobId}`);
  return entry.release;
};

describe("VideoJobWorker shutdown release (double-publish regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: the shutdown-release path previously called BOTH
  // releaseClaim (which requeues the job to status="queued") AND
  // enqueueDeadLetter with retryable: true. The next worker pod could
  // then claim the requeued record while the DLQ reprocessor also
  // re-ran the DLQ entry — duplicate work, duplicate cost, duplicate
  // provider calls. The invariant is that shutdown-release must
  // requeue XOR DLQ, never both. We chose requeue: if the job later
  // fails terminally, processVideoJob handles DLQ enqueuing via
  // dlqSource="worker-terminal".

  it("on shutdown-release, requeues but does NOT enqueue to DLQ", async () => {
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      requeueForRetry: vi.fn(),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(true),
      renewLease: vi.fn().mockResolvedValue(true),
    };

    // never-resolving generation so processJob stays mid-flight while we inspect activeJobs
    const generateVideo = vi
      .fn()
      .mockImplementation(() => new Promise(() => undefined));

    const worker = new VideoJobWorker(
      jobStore as never,
      { generateVideo } as never,
      { refundCredits: vi.fn() } as never,
      { saveFromUrl: vi.fn() } as never,
      {
        workerId: "worker-drain",
        pollIntervalMs: 1_000,
        leaseMs: 60_000,
        maxConcurrent: 1,
        heartbeatIntervalMs: 10_000,
      },
    );

    const job = createJob();
    // Kick off processJob without awaiting (it will never resolve in this test)
    void (
      worker as unknown as {
        processJob: (r: VideoJobRecord) => Promise<void>;
      }
    ).processJob(job);

    // Give the microtask queue a tick so activeJobs is populated
    await Promise.resolve();

    const release = getActiveJobRelease(worker, job.id);
    await release();

    expect(jobStore.releaseClaim).toHaveBeenCalledTimes(1);
    expect(jobStore.releaseClaim).toHaveBeenCalledWith(
      job.id,
      "worker-drain",
      expect.stringContaining("shutdown"),
    );
    expect(jobStore.enqueueDeadLetter).not.toHaveBeenCalled();
  });

  it("skips the metric emit when releaseClaim fails (released=false)", async () => {
    const jobStore: MinimalJobStore = {
      claimNextJob: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      requeueForRetry: vi.fn(),
      enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
      releaseClaim: vi.fn().mockResolvedValue(false),
      renewLease: vi.fn().mockResolvedValue(true),
    };

    const generateVideo = vi
      .fn()
      .mockImplementation(() => new Promise(() => undefined));

    const worker = new VideoJobWorker(
      jobStore as never,
      { generateVideo } as never,
      { refundCredits: vi.fn() } as never,
      { saveFromUrl: vi.fn() } as never,
      {
        workerId: "worker-drain-2",
        pollIntervalMs: 1_000,
        leaseMs: 60_000,
        maxConcurrent: 1,
        heartbeatIntervalMs: 10_000,
      },
    );

    const job = createJob({ id: "job-drain-2" });
    void (
      worker as unknown as {
        processJob: (r: VideoJobRecord) => Promise<void>;
      }
    ).processJob(job);
    await Promise.resolve();

    const release = getActiveJobRelease(worker, job.id);
    await release();

    expect(jobStore.releaseClaim).toHaveBeenCalledTimes(1);
    // Even on failed release, DLQ must NOT be populated — original bug path
    expect(jobStore.enqueueDeadLetter).not.toHaveBeenCalled();
  });
});
