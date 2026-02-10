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

import { CreditRefundSweeper } from '../CreditRefundSweeper';

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
});
