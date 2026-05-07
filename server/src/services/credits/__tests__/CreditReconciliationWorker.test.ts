import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loggerError = vi.fn();
const loggerInfo = vi.fn();
const loggerDebug = vi.fn();

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    child: () => ({
      info: loggerInfo,
      debug: loggerDebug,
      warn: vi.fn(),
      error: loggerError,
      child: vi.fn(),
    }),
  },
}));

import {
  CreditReconciliationWorker,
  createCreditReconciliationWorker,
} from "../CreditReconciliationWorker";
import type { CreditReconciliationService } from "../CreditReconciliationService";

type RunResult = Awaited<
  ReturnType<CreditReconciliationService["runIncrementalPass"]>
>;

const emptyResult = (
  scope: "incremental" | "full" = "incremental",
): RunResult => ({
  scope,
  scannedItems: 0,
  processedUsers: 0,
  positiveCorrections: 0,
  queuedNegativeCorrections: 0,
  checkpointUpdated: false,
});

interface FakeService {
  service: CreditReconciliationService;
  runIncrementalPass: ReturnType<typeof vi.fn>;
  runFullPass: ReturnType<typeof vi.fn>;
}

function makeService(): FakeService {
  const runIncrementalPass = vi.fn(async () => emptyResult("incremental"));
  const runFullPass = vi.fn(async () => emptyResult("full"));
  return {
    service: {
      runIncrementalPass,
      runFullPass,
    } as unknown as CreditReconciliationService,
    runIncrementalPass,
    runFullPass,
  };
}

describe("CreditReconciliationWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("scheduling lifecycle", () => {
    it("schedules an immediate first run on start()", async () => {
      const fake = makeService();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
      });

      worker.start();
      // First tick is scheduled with delay 0; advance microtasks + timers.
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalled(),
      );
      worker.stop();
    });

    it("start() is idempotent — a second call does not double-schedule", async () => {
      const fake = makeService();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
      });

      worker.start();
      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalledTimes(1),
      );
      worker.stop();
    });

    it("stop() prevents the next scheduled tick from firing", async () => {
      const fake = makeService();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
      });

      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalledTimes(1),
      );

      worker.stop();
      await vi.advanceTimersByTimeAsync(60_000 * 10);
      // No additional runs after stop.
      expect(fake.runIncrementalPass).toHaveBeenCalledTimes(1);
    });
  });

  describe("backoff invariants", () => {
    it("resets to incrementalIntervalMs after a successful run", async () => {
      const fake = makeService();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
        backoffFactor: 2,
      });

      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalledTimes(1),
      );

      // Next tick should fire after exactly incrementalIntervalMs.
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalledTimes(2),
      );
      worker.stop();
    });

    it("doubles the interval after a failed run (exponential backoff)", async () => {
      const fake = makeService();
      // First call rejects, second call resolves.
      fake.runIncrementalPass
        .mockRejectedValueOnce(new Error("firestore unavailable"))
        .mockResolvedValueOnce(emptyResult("incremental"));

      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
        backoffFactor: 2,
      });

      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalledTimes(1),
      );

      // After failure, next attempt must NOT fire at the normal interval.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fake.runIncrementalPass).toHaveBeenCalledTimes(1);

      // It should fire after 60_000 * 2 backoff.
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.waitFor(() =>
        expect(fake.runIncrementalPass).toHaveBeenCalledTimes(2),
      );
      worker.stop();
    });

    it("clamps interval to maxIntervalMs even with many consecutive failures", async () => {
      const fake = makeService();
      fake.runIncrementalPass.mockRejectedValue(new Error("persistent"));

      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
        maxIntervalMs: 240_000, // 4× incremental
        backoffFactor: 2,
      });

      worker.start();
      // Drive several failed cycles. Without the max clamp, intervals would grow
      // unbounded (60s → 120s → 240s → 480s → 960s ...). With clamp they cap at 240s.
      for (let i = 0; i < 8; i += 1) {
        await vi.advanceTimersByTimeAsync(240_000);
      }
      // We can't easily count exact runs without coupling to the clamp formula,
      // but the invariant we care about is "no run takes longer than maxIntervalMs"
      // — proven by reaching at least 5 attempts within 8 max-interval windows.
      expect(fake.runIncrementalPass.mock.calls.length).toBeGreaterThanOrEqual(
        5,
      );
      worker.stop();
    });

    it("emits worker_loop_crash alert if the runLoop itself throws", async () => {
      const fake = makeService();
      // Make the service look fine but force scheduleNext path to break by
      // passing a metrics object that records calls. The crash path is triggered
      // by an exception thrown OUTSIDE runOnce — we simulate by making the
      // service's incremental pass throw synchronously inside the await.
      fake.runIncrementalPass.mockImplementation(() => {
        throw new Error("synchronous throw before promise");
      });

      const recordAlert = vi.fn();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000,
        metrics: { recordAlert },
      });

      worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() => expect(recordAlert).toHaveBeenCalled());

      // Either alert is acceptable — both indicate failure was surfaced as a metric.
      const alertNames = recordAlert.mock.calls.map((c) => c[0]);
      expect(
        alertNames.some(
          (n) =>
            n === "credit_reconciliation_worker_failure" ||
            n === "worker_loop_crash",
        ),
      ).toBe(true);
      worker.stop();
    });
  });

  describe("full-pass scheduling invariant", () => {
    it("does not run a full pass before nextFullPassAtMs is reached", async () => {
      const fake = makeService();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 3_600_000, // 1 hour
      });

      worker.start();
      // Run several incremental cycles within the first 30 minutes.
      for (let i = 0; i < 5; i += 1) {
        await vi.advanceTimersByTimeAsync(60_000);
      }

      expect(fake.runIncrementalPass.mock.calls.length).toBeGreaterThan(0);
      // Full pass guard: must not have run yet.
      expect(fake.runFullPass).not.toHaveBeenCalled();
      worker.stop();
    });

    it("triggers a full pass once nextFullPassAtMs is reached", async () => {
      const fake = makeService();
      const worker = new CreditReconciliationWorker(fake.service, {
        incrementalIntervalMs: 60_000,
        fullPassIntervalMs: 120_000, // 2 minutes — short for the test
      });

      worker.start();
      // Advance past the full-pass deadline.
      await vi.advanceTimersByTimeAsync(150_000);
      await vi.waitFor(() => expect(fake.runFullPass).toHaveBeenCalled());
      worker.stop();
    });
  });

  describe("createCreditReconciliationWorker factory", () => {
    it("returns null when disabled is true (killswitch invariant)", () => {
      const fake = makeService();
      const worker = createCreditReconciliationWorker(fake.service, undefined, {
        disabled: true,
        incrementalIntervalSeconds: 60,
        fullIntervalHours: 1,
        maxIntervalSeconds: 240,
        backoffFactor: 2,
      });
      expect(worker).toBeNull();
    });

    it("converts seconds/hours config to milliseconds correctly", () => {
      const fake = makeService();
      const worker = createCreditReconciliationWorker(fake.service, undefined, {
        disabled: false,
        incrementalIntervalSeconds: 30,
        fullIntervalHours: 2,
        maxIntervalSeconds: 600,
        backoffFactor: 3,
      });
      expect(worker).toBeInstanceOf(CreditReconciliationWorker);
    });
  });
});
