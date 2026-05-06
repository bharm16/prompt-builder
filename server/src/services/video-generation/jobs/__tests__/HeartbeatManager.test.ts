import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeartbeatManager } from "../HeartbeatManager";

const makeLogger = (): {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} => ({
  warn: vi.fn(),
  error: vi.fn(),
});

describe("HeartbeatManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls renewLease on each interval tick and resets failure counter on success", async () => {
    const renewLease = vi.fn().mockResolvedValue(true);
    const log = makeLogger();
    const onFailure = vi.fn();
    const onAbort = vi.fn();

    const hb = new HeartbeatManager({
      jobId: "job-1",
      workerId: "worker-1",
      leaseMs: 60_000,
      intervalMs: 1_000,
      renewLease,
      maxConsecutiveFailures: 3,
      logger: log,
      onFailure,
      onAbort,
    });

    hb.start();

    // Drive two ticks.
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    hb.stop();

    expect(renewLease).toHaveBeenCalledWith("job-1", "worker-1", 60_000);
    expect(renewLease).toHaveBeenCalledTimes(2);
    expect(onFailure).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("increments consecutive failures and triggers onAbort at threshold", async () => {
    const renewLease = vi.fn().mockResolvedValue(false);
    const log = makeLogger();
    const onFailure = vi.fn();
    const onAbort = vi.fn();

    const hb = new HeartbeatManager({
      jobId: "job-2",
      workerId: "worker-1",
      leaseMs: 10_000,
      intervalMs: 1_000,
      renewLease,
      maxConsecutiveFailures: 3,
      logger: log,
      onFailure,
      onAbort,
    });

    hb.start();

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    hb.stop();

    expect(onFailure).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenNthCalledWith(1, 1, undefined);
    expect(onFailure).toHaveBeenNthCalledWith(2, 2, undefined);
    expect(onFailure).toHaveBeenNthCalledWith(3, 3, undefined);
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledWith(expect.any(Error));
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("never aborts when maxConsecutiveFailures is undefined (inline-processor behavior)", async () => {
    const renewLease = vi.fn().mockResolvedValue(false);
    const log = makeLogger();
    const onAbort = vi.fn();

    const hb = new HeartbeatManager({
      jobId: "job-3",
      workerId: "worker-1",
      leaseMs: 10_000,
      intervalMs: 500,
      renewLease,
      logger: log,
      onAbort,
    });

    hb.start();

    // 10 failed ticks — still no abort.
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(500);
    }

    hb.stop();

    expect(renewLease).toHaveBeenCalledTimes(10);
    expect(onAbort).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("treats thrown errors as failures and still increments the counter", async () => {
    const renewLease = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(true);
    const log = makeLogger();
    const onFailure = vi.fn();

    const hb = new HeartbeatManager({
      jobId: "job-4",
      workerId: "worker-1",
      leaseMs: 10_000,
      intervalMs: 1_000,
      renewLease,
      maxConsecutiveFailures: 3,
      logger: log,
      onFailure,
    });

    hb.start();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    hb.stop();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(1, expect.any(Error));
    // Second tick succeeded → no additional onFailure.
  });

  it("stop() halts the timer; further time advances do not call renewLease", async () => {
    const renewLease = vi.fn().mockResolvedValue(true);
    const log = makeLogger();

    const hb = new HeartbeatManager({
      jobId: "job-5",
      workerId: "worker-1",
      leaseMs: 10_000,
      intervalMs: 1_000,
      renewLease,
      logger: log,
    });

    hb.start();
    await vi.advanceTimersByTimeAsync(1_000);
    hb.stop();

    const callsAtStop = renewLease.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);

    expect(renewLease.mock.calls.length).toBe(callsAtStop);
  });
});
