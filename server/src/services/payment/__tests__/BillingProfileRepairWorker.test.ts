import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    })),
  },
}));

import { BillingProfileRepairWorker } from '../BillingProfileRepairWorker';

function createDeps() {
  return {
    consistencyStore: {
      claimNextBillingProfileRepair: vi.fn().mockResolvedValue(null),
      markBillingProfileRepairResolved: vi.fn().mockResolvedValue(undefined),
      releaseBillingProfileRepairForRetry: vi.fn().mockResolvedValue(undefined),
      markBillingProfileRepairEscalated: vi.fn().mockResolvedValue(undefined),
    },
    billingProfileStore: {
      upsertProfile: vi.fn().mockResolvedValue(undefined),
    },
    metrics: {
      recordAlert: vi.fn(),
    },
  };
}

describe('BillingProfileRepairWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves pending repair tasks when profile upsert succeeds', async () => {
    const deps = createDeps();
    deps.consistencyStore.claimNextBillingProfileRepair
      .mockResolvedValueOnce({
        repairKey: 'invoice:in_1',
        source: 'invoice',
        userId: 'user-1',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripeLivemode: false,
        referenceId: 'in_1',
        attempts: 0,
      })
      .mockResolvedValueOnce(null);

    const worker = new BillingProfileRepairWorker(
      deps.consistencyStore as never,
      deps.billingProfileStore as never,
      {
        pollIntervalMs: 1_000,
        maxPerRun: 5,
        maxAttempts: 3,
        metrics: deps.metrics,
      }
    );

    worker.start();
    await vi.advanceTimersByTimeAsync(1_100);
    worker.stop();

    expect(deps.billingProfileStore.upsertProfile).toHaveBeenCalledWith('user-1', {
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeLivemode: false,
    });
    expect(deps.consistencyStore.markBillingProfileRepairResolved).toHaveBeenCalledWith('invoice:in_1');
    expect(deps.consistencyStore.releaseBillingProfileRepairForRetry).not.toHaveBeenCalled();
    expect(deps.consistencyStore.markBillingProfileRepairEscalated).not.toHaveBeenCalled();
  });

  it('requeues task for retry when profile upsert fails before max attempts', async () => {
    const deps = createDeps();
    deps.consistencyStore.claimNextBillingProfileRepair
      .mockResolvedValueOnce({
        repairKey: 'checkout:cs_1',
        source: 'checkout',
        userId: 'user-2',
        stripeCustomerId: 'cus_2',
        stripeLivemode: false,
        referenceId: 'cs_1',
        attempts: 0,
      })
      .mockResolvedValueOnce(null);
    deps.billingProfileStore.upsertProfile.mockRejectedValueOnce(new Error('db unavailable'));

    const worker = new BillingProfileRepairWorker(
      deps.consistencyStore as never,
      deps.billingProfileStore as never,
      {
        pollIntervalMs: 1_000,
        maxPerRun: 5,
        maxAttempts: 3,
        metrics: deps.metrics,
      }
    );

    worker.start();
    await vi.advanceTimersByTimeAsync(1_100);
    worker.stop();

    expect(deps.consistencyStore.releaseBillingProfileRepairForRetry).toHaveBeenCalledWith(
      'checkout:cs_1',
      'db unavailable'
    );
    expect(deps.consistencyStore.markBillingProfileRepairEscalated).not.toHaveBeenCalled();
  });

  it('escalates and alerts when profile upsert fails at max attempts', async () => {
    const deps = createDeps();
    deps.consistencyStore.claimNextBillingProfileRepair
      .mockResolvedValueOnce({
        repairKey: 'invoice:in_2',
        source: 'invoice',
        userId: 'user-3',
        stripeCustomerId: 'cus_3',
        stripeLivemode: true,
        referenceId: 'in_2',
        attempts: 2,
      })
      .mockResolvedValueOnce(null);
    deps.billingProfileStore.upsertProfile.mockRejectedValueOnce(new Error('permission denied'));

    const worker = new BillingProfileRepairWorker(
      deps.consistencyStore as never,
      deps.billingProfileStore as never,
      {
        pollIntervalMs: 1_000,
        maxPerRun: 5,
        maxAttempts: 3,
        metrics: deps.metrics,
      }
    );

    worker.start();
    await vi.advanceTimersByTimeAsync(1_100);
    worker.stop();

    expect(deps.consistencyStore.markBillingProfileRepairEscalated).toHaveBeenCalledWith(
      'invoice:in_2',
      'permission denied'
    );
    expect(deps.metrics.recordAlert).toHaveBeenCalledWith(
      'billing_profile_repair_escalated',
      expect.objectContaining({
        repairKey: 'invoice:in_2',
        userId: 'user-3',
        source: 'invoice',
        attempts: 3,
      })
    );
  });
});
