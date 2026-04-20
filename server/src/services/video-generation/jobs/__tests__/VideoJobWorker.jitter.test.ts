import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

type MinimalJobStore = {
  claimNextJob: ReturnType<typeof vi.fn>;
  markCompleted: ReturnType<typeof vi.fn>;
  markFailed: ReturnType<typeof vi.fn>;
  requeueForRetry: ReturnType<typeof vi.fn>;
  enqueueDeadLetter: ReturnType<typeof vi.fn>;
  releaseClaim: ReturnType<typeof vi.fn>;
  renewLease: ReturnType<typeof vi.fn>;
};

const buildJobStore = (): MinimalJobStore => ({
  claimNextJob: vi.fn().mockResolvedValue(null),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
  requeueForRetry: vi.fn(),
  enqueueDeadLetter: vi.fn().mockResolvedValue(undefined),
  releaseClaim: vi.fn().mockResolvedValue(true),
  renewLease: vi.fn().mockResolvedValue(true),
});

const createWorker = (pollIntervalMs: number): VideoJobWorker =>
  new VideoJobWorker(
    buildJobStore() as never,
    { process: vi.fn().mockResolvedValue(undefined) },
    {
      workerId: "worker-jitter",
      pollIntervalMs,
      leaseMs: 60_000,
      maxConcurrent: 1,
      heartbeatIntervalMs: 10_000,
    },
  );

describe("VideoJobWorker start jitter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Invariant: the first scheduled tick after start() must be delayed by a
  // jittered value in [0, basePollIntervalMs). Prevents thundering-herd on
  // simultaneous replica restarts.
  it("schedules the first tick with a jittered delay in [0, basePollIntervalMs)", () => {
    const pollIntervalMs = 1_000;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const worker = createWorker(pollIntervalMs);
    worker.start();

    // The jitter delay should be the only timer setTimeout call with a
    // non-"setInterval" origin here; the heartbeat uses setInterval.
    const firstSetTimeoutCall = setTimeoutSpy.mock.calls[0];
    expect(firstSetTimeoutCall).toBeDefined();
    const delayArg = firstSetTimeoutCall![1];
    expect(typeof delayArg).toBe("number");
    expect(delayArg).toBeGreaterThanOrEqual(0);
    expect(delayArg).toBeLessThan(pollIntervalMs);
    // With Math.random mocked to 0.5, floor(0.5 * 1000) === 500.
    expect(delayArg).toBe(500);

    worker.stop();
  });

  it("schedules a delay of 0 when Math.random returns 0 (boundary check)", () => {
    const pollIntervalMs = 2_000;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    vi.spyOn(Math, "random").mockReturnValue(0);

    const worker = createWorker(pollIntervalMs);
    worker.start();

    const firstSetTimeoutCall = setTimeoutSpy.mock.calls[0];
    expect(firstSetTimeoutCall).toBeDefined();
    expect(firstSetTimeoutCall![1]).toBe(0);

    worker.stop();
  });

  it("schedules a delay strictly less than basePollIntervalMs (upper bound)", () => {
    const pollIntervalMs = 500;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    // Math.random is in [0, 1); floor(0.999999 * 500) === 499.
    vi.spyOn(Math, "random").mockReturnValue(0.999999);

    const worker = createWorker(pollIntervalMs);
    worker.start();

    const firstSetTimeoutCall = setTimeoutSpy.mock.calls[0];
    expect(firstSetTimeoutCall).toBeDefined();
    const delayArg = firstSetTimeoutCall![1] as number;
    expect(delayArg).toBeLessThan(pollIntervalMs);
    expect(delayArg).toBe(499);

    worker.stop();
  });
});
