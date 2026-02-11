import { describe, expect, it, vi } from 'vitest';
import { buildRefundKey, refundWithGuard } from '../refundGuard';

describe('refundGuard', () => {
  it('treats zero amount as a no-op success', async () => {
    const refundCredits = vi.fn();
    const failureStore = {
      upsertFailure: vi.fn(),
    };

    const ok = await refundWithGuard({
      userCreditService: {
        refundCredits,
      } as never,
      userId: 'user-1',
      amount: 0,
      refundKey: 'refund-key-1',
      refundFailureStore: failureStore as never,
    });

    expect(ok).toBe(true);
    expect(refundCredits).not.toHaveBeenCalled();
    expect(failureStore.upsertFailure).not.toHaveBeenCalled();
  });

  it('uses at least one attempt when requestRetries is 0', async () => {
    const refundCredits = vi.fn().mockResolvedValue(true);
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
      requestRetries: 0,
      refundFailureStore: failureStore as never,
    });

    expect(ok).toBe(true);
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(failureStore.upsertFailure).not.toHaveBeenCalled();
  });

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

  it('applies exponential backoff between retries', async () => {
    const refundCredits = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const failureStore = {
      upsertFailure: vi.fn(),
    };
    const timeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((handler: () => void) => {
        handler();
        return 0 as unknown as NodeJS.Timeout;
      }) as typeof setTimeout);

    const ok = await refundWithGuard({
      userCreditService: {
        refundCredits,
      } as never,
      userId: 'user-1',
      amount: 5,
      refundKey: 'refund-key-1',
      requestRetries: 3,
      baseDelayMs: 11,
      refundFailureStore: failureStore as never,
    });

    expect(ok).toBe(true);
    expect(timeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 11);
    expect(timeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 22);
    timeoutSpy.mockRestore();
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

  it('returns false when failure-store enqueue fails after retry exhaustion', async () => {
    const refundCredits = vi.fn().mockResolvedValue(false);
    const failureStore = {
      upsertFailure: vi.fn().mockRejectedValue(new Error('Firestore down')),
    };

    const ok = await refundWithGuard({
      userCreditService: {
        refundCredits,
      } as never,
      userId: 'user-1',
      amount: 5,
      refundKey: 'refund-key-1',
      requestRetries: 2,
      baseDelayMs: 1,
      refundFailureStore: failureStore as never,
    });

    expect(ok).toBe(false);
    expect(refundCredits).toHaveBeenCalledTimes(2);
    expect(failureStore.upsertFailure).toHaveBeenCalledTimes(1);
  });

  it('builds deterministic refund keys', () => {
    const a = buildRefundKey(['video-job', 'job-1', 'video']);
    const b = buildRefundKey(['video-job', 'job-1', 'video']);
    const c = buildRefundKey(['video-job', 'job-2', 'video']);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('filters null and undefined parts when building refund keys', () => {
    const a = buildRefundKey(['video-job', null, undefined, 'job-1']);
    const b = buildRefundKey(['video-job', 'job-1']);

    expect(a).toBe(b);
  });
});
