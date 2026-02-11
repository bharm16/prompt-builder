import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  recordAlert: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      info: mocks.loggerInfo,
      error: mocks.loggerError,
      warn: mocks.loggerWarn,
    }),
  },
}));

vi.mock('@infrastructure/MetricsService', () => ({
  metricsService: {
    recordAlert: mocks.recordAlert,
  },
}));

import { CreditRefundSweeper, createCreditRefundSweeper } from '../CreditRefundSweeper';

describe('CreditRefundSweeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries a pending refund and marks it resolved on success', async () => {
    const claimNextPending = vi
      .fn()
      .mockResolvedValueOnce({
        refundKey: 'refund-key-1',
        userId: 'user-1',
        amount: 5,
        attempts: 0,
      })
      .mockResolvedValueOnce(null);

    const failureStore = {
      claimNextPending,
      markResolved: vi.fn().mockResolvedValue(undefined),
      releaseForRetry: vi.fn().mockResolvedValue(undefined),
      markEscalated: vi.fn().mockResolvedValue(undefined),
    };

    const refundCredits = vi.fn().mockResolvedValue(true);

    const sweeper = new CreditRefundSweeper(
      failureStore as never,
      {
        refundCredits,
      } as never,
      {
        sweepIntervalMs: 60_000,
        maxPerRun: 10,
        maxAttempts: 20,
      }
    );

    await (sweeper as unknown as { runOnce: () => Promise<void> }).runOnce();

    expect(refundCredits).toHaveBeenCalledWith('user-1', 5, {
      refundKey: 'refund-key-1',
    });
    expect(failureStore.markResolved).toHaveBeenCalledWith('refund-key-1');
    expect(failureStore.releaseForRetry).not.toHaveBeenCalled();
    expect(failureStore.markEscalated).not.toHaveBeenCalled();
  });

  it('escalates after max attempts and records alert metric', async () => {
    const claimNextPending = vi
      .fn()
      .mockResolvedValueOnce({
        refundKey: 'refund-key-2',
        userId: 'user-2',
        amount: 7,
        attempts: 19,
      })
      .mockResolvedValueOnce(null);

    const failureStore = {
      claimNextPending,
      markResolved: vi.fn().mockResolvedValue(undefined),
      releaseForRetry: vi.fn().mockResolvedValue(undefined),
      markEscalated: vi.fn().mockResolvedValue(undefined),
    };

    const refundCredits = vi.fn().mockResolvedValue(false);

    const sweeper = new CreditRefundSweeper(
      failureStore as never,
      {
        refundCredits,
      } as never,
      {
        sweepIntervalMs: 60_000,
        maxPerRun: 10,
        maxAttempts: 20,
      }
    );

    await (sweeper as unknown as { runOnce: () => Promise<void> }).runOnce();

    expect(failureStore.markEscalated).toHaveBeenCalledWith(
      'refund-key-2',
      'Background refund retry failed'
    );
    expect(mocks.recordAlert).toHaveBeenCalledWith(
      'credit_refund_escalated',
      expect.objectContaining({
        refundKey: 'refund-key-2',
        userId: 'user-2',
        amount: 7,
        attempts: 20,
      })
    );
  });

  it('releases for retry when refund fails but max attempts is not reached', async () => {
    const claimNextPending = vi
      .fn()
      .mockResolvedValueOnce({
        refundKey: 'refund-key-3',
        userId: 'user-3',
        amount: 9,
        attempts: 1,
      })
      .mockResolvedValueOnce(null);

    const failureStore = {
      claimNextPending,
      markResolved: vi.fn().mockResolvedValue(undefined),
      releaseForRetry: vi.fn().mockResolvedValue(undefined),
      markEscalated: vi.fn().mockResolvedValue(undefined),
    };
    const refundCredits = vi.fn().mockResolvedValue(false);

    const sweeper = new CreditRefundSweeper(
      failureStore as never,
      { refundCredits } as never,
      { sweepIntervalMs: 60_000, maxPerRun: 10, maxAttempts: 20 }
    );

    await (sweeper as unknown as { runOnce: () => Promise<void> }).runOnce();

    expect(failureStore.releaseForRetry).toHaveBeenCalledWith(
      'refund-key-3',
      'Background refund retry failed'
    );
    expect(failureStore.markEscalated).not.toHaveBeenCalled();
  });

  it('does not run concurrently when runOnce is already in progress', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });

    const claimNextPending = vi
      .fn()
      .mockResolvedValueOnce({
        refundKey: 'refund-key-4',
        userId: 'user-4',
        amount: 4,
        attempts: 0,
      })
      .mockResolvedValueOnce(null);

    const failureStore = {
      claimNextPending,
      markResolved: vi.fn().mockResolvedValue(undefined),
      releaseForRetry: vi.fn().mockResolvedValue(undefined),
      markEscalated: vi.fn().mockResolvedValue(undefined),
    };

    const refundCredits = vi.fn(async () => {
      await gate;
      return true;
    });

    const sweeper = new CreditRefundSweeper(
      failureStore as never,
      { refundCredits } as never,
      { sweepIntervalMs: 60_000, maxPerRun: 10, maxAttempts: 20 }
    );

    const run1 = (sweeper as unknown as { runOnce: () => Promise<void> }).runOnce();
    const run2 = (sweeper as unknown as { runOnce: () => Promise<void> }).runOnce();

    expect(claimNextPending).toHaveBeenCalledTimes(1);
    if (release) release();
    await Promise.all([run1, run2]);
  });

  it('logs run failures from store or service errors', async () => {
    const failureStore = {
      claimNextPending: vi.fn().mockRejectedValue(new Error('store unavailable')),
      markResolved: vi.fn().mockResolvedValue(undefined),
      releaseForRetry: vi.fn().mockResolvedValue(undefined),
      markEscalated: vi.fn().mockResolvedValue(undefined),
    };

    const sweeper = new CreditRefundSweeper(
      failureStore as never,
      { refundCredits: vi.fn() } as never,
      { sweepIntervalMs: 60_000, maxPerRun: 10, maxAttempts: 20 }
    );

    await (sweeper as unknown as { runOnce: () => Promise<void> }).runOnce();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Credit refund sweeper run failed',
      expect.any(Error)
    );
  });

  it('starts and stops interval only once when called repeatedly', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const failureStore = {
      claimNextPending: vi.fn().mockResolvedValue(null),
      markResolved: vi.fn().mockResolvedValue(undefined),
      releaseForRetry: vi.fn().mockResolvedValue(undefined),
      markEscalated: vi.fn().mockResolvedValue(undefined),
    };
    const sweeper = new CreditRefundSweeper(
      failureStore as never,
      { refundCredits: vi.fn().mockResolvedValue(true) } as never,
      { sweepIntervalMs: 60_000, maxPerRun: 10, maxAttempts: 20 }
    );

    sweeper.start();
    sweeper.start();
    sweeper.stop();
    sweeper.stop();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});

describe('createCreditRefundSweeper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when sweeper is disabled by env', () => {
    process.env.CREDIT_REFUND_SWEEPER_DISABLED = 'true';

    const sweeper = createCreditRefundSweeper(
      {} as never,
      {} as never
    );

    expect(sweeper).toBeNull();
  });

  it('returns null when env numeric values are invalid', () => {
    process.env.CREDIT_REFUND_SWEEP_INTERVAL_SECONDS = '0';
    process.env.CREDIT_REFUND_SWEEP_MAX = '0';
    process.env.CREDIT_REFUND_MAX_ATTEMPTS = '0';

    const sweeper = createCreditRefundSweeper(
      {} as never,
      {} as never
    );

    expect(sweeper).toBeNull();
  });

  it('creates sweeper when env values are valid', () => {
    process.env.CREDIT_REFUND_SWEEPER_DISABLED = 'false';
    process.env.CREDIT_REFUND_SWEEP_INTERVAL_SECONDS = '30';
    process.env.CREDIT_REFUND_SWEEP_MAX = '5';
    process.env.CREDIT_REFUND_MAX_ATTEMPTS = '8';

    const sweeper = createCreditRefundSweeper(
      {} as never,
      {} as never
    );

    expect(sweeper).toBeInstanceOf(CreditRefundSweeper);
  });
});
