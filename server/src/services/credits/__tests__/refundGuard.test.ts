import { describe, expect, it, vi } from 'vitest';
import { buildRefundKey, refundWithGuard } from '../refundGuard';

describe('refundGuard', () => {
  it('retries transient refund failures and succeeds before DLQ enqueue', async () => {
    const refundCredits = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const failureStore = {
      upsertFailure: vi.fn(),
    };

    const ok = await refundWithGuard({
      userCreditService: {
        refundCredits,
      } as never,
      userId: 'user-1',
      amount: 5,
      refundKey: 'refund-key-1',
      requestRetries: 3,
      baseDelayMs: 1,
      refundFailureStore: failureStore as never,
    });

    expect(ok).toBe(true);
    expect(refundCredits).toHaveBeenCalledTimes(3);
    expect(failureStore.upsertFailure).not.toHaveBeenCalled();
  });

  it('enqueues refund failure to DLQ after retry exhaustion', async () => {
    const refundCredits = vi.fn().mockResolvedValue(false);
    const failureStore = {
      upsertFailure: vi.fn().mockResolvedValue(undefined),
    };

    const ok = await refundWithGuard({
      userCreditService: {
        refundCredits,
      } as never,
      userId: 'user-1',
      amount: 5,
      refundKey: 'refund-key-1',
      reason: 'video generation failed',
      requestRetries: 3,
      baseDelayMs: 1,
      metadata: { route: 'preview/video/generate' },
      refundFailureStore: failureStore as never,
    });

    expect(ok).toBe(false);
    expect(refundCredits).toHaveBeenCalledTimes(3);
    expect(failureStore.upsertFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        refundKey: 'refund-key-1',
        userId: 'user-1',
        amount: 5,
        reason: 'video generation failed',
      })
    );
  });

  it('builds deterministic refund keys', () => {
    const a = buildRefundKey(['video-job', 'job-1', 'video']);
    const b = buildRefundKey(['video-job', 'job-1', 'video']);
    const c = buildRefundKey(['video-job', 'job-2', 'video']);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
