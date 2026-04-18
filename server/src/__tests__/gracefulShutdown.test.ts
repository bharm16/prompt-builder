import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/Logger.ts", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock("../config/redis.ts", () => ({
  closeRedisClient: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../config/runtime-flags.ts", () => ({
  getRuntimeFlags: vi.fn(() => ({
    unhandledRejectionMode: "classified",
    videoWorkerShutdownDrainSeconds: 5,
    processRole: "api",
    videoWorkerDisabled: false,
  })),
}));

import { stopAllPeriodicWorkers } from "../server.ts";
import type { DIContainer } from "../infrastructure/DIContainer.ts";

interface StoppableMock {
  stop: ReturnType<typeof vi.fn>;
}

/**
 * Build a minimal DIContainer-like stub that returns the provided service map.
 * Missing names throw (mirrors the real container), and `resolveOptional` inside
 * `stopAllPeriodicWorkers` swallows the throw to null.
 */
function buildContainer(
  services: Record<string, unknown>,
): Pick<DIContainer, "resolve"> {
  return {
    resolve: <T>(name: string): T => {
      if (!(name in services)) {
        throw new Error(`Unknown service: ${name}`);
      }
      return services[name] as T;
    },
  };
}

function buildStoppable(): StoppableMock {
  return { stop: vi.fn() };
}

describe("stopAllPeriodicWorkers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Invariant: every periodic worker registered by the graceful shutdown
  // wiring must have `.stop()` invoked. If a new worker is added in the DI
  // container without being wired into shutdown, its interval timers keep the
  // process alive past the drain budget. The four call-outs below are the
  // four workers added in this fix.
  it("calls .stop() on every registered periodic worker", () => {
    const videoJobSweeper = buildStoppable();
    const creditRefundSweeper = buildStoppable();
    const creditReconciliationWorker = buildStoppable();
    const videoAssetRetentionService = buildStoppable();
    const webhookReconciliationWorker = buildStoppable();
    const billingProfileRepairWorker = buildStoppable();
    const dlqReprocessorWorker = buildStoppable();
    const videoJobReconciler = buildStoppable();
    const capabilitiesProbeService = buildStoppable();

    const container = buildContainer({
      videoJobSweeper,
      creditRefundSweeper,
      creditReconciliationWorker,
      videoAssetRetentionService,
      webhookReconciliationWorker,
      billingProfileRepairWorker,
      dlqReprocessorWorker,
      videoJobReconciler,
      capabilitiesProbeService,
    });

    stopAllPeriodicWorkers(container as DIContainer);

    // The four newly-wired workers — the primary assertion for this regression.
    expect(webhookReconciliationWorker.stop).toHaveBeenCalledTimes(1);
    expect(billingProfileRepairWorker.stop).toHaveBeenCalledTimes(1);
    expect(dlqReprocessorWorker.stop).toHaveBeenCalledTimes(1);
    expect(videoJobReconciler.stop).toHaveBeenCalledTimes(1);

    // Pre-existing workers must still be stopped — guards against regressions.
    expect(videoJobSweeper.stop).toHaveBeenCalledTimes(1);
    expect(creditRefundSweeper.stop).toHaveBeenCalledTimes(1);
    expect(creditReconciliationWorker.stop).toHaveBeenCalledTimes(1);
    expect(videoAssetRetentionService.stop).toHaveBeenCalledTimes(1);
    expect(capabilitiesProbeService.stop).toHaveBeenCalledTimes(1);
  });

  it("tolerates null-registered workers (feature-flag-disabled paths)", () => {
    const videoJobSweeper = buildStoppable();
    const container = buildContainer({
      videoJobSweeper,
      // These are legitimately null when their feature flags disable them.
      creditRefundSweeper: null,
      creditReconciliationWorker: null,
      videoAssetRetentionService: null,
      webhookReconciliationWorker: null,
      billingProfileRepairWorker: null,
      dlqReprocessorWorker: null,
      videoJobReconciler: null,
      capabilitiesProbeService: null,
    });

    expect(() =>
      stopAllPeriodicWorkers(container as DIContainer),
    ).not.toThrow();
    expect(videoJobSweeper.stop).toHaveBeenCalledTimes(1);
  });

  it("tolerates unregistered worker names (resolve throws are caught)", () => {
    // Only one worker is registered; others throw on resolve. The helper must
    // not propagate the throw — it mirrors production where optional services
    // may not be registered at all in some roles.
    const videoJobSweeper = buildStoppable();
    const container = buildContainer({ videoJobSweeper });

    expect(() =>
      stopAllPeriodicWorkers(container as DIContainer),
    ).not.toThrow();
    expect(videoJobSweeper.stop).toHaveBeenCalledTimes(1);
  });
});
