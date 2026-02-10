import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  transactionGet: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionSet: vi.fn(),
  userDocUpdate: vi.fn(),
  existingRefund: false,
  increment: vi.fn((value: number) => ({ __op: 'increment', value })),
  serverTimestamp: vi.fn(() => ({ __op: 'serverTimestamp' })),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  admin: {
    firestore: {
      FieldValue: {
        increment: mocks.increment,
        serverTimestamp: mocks.serverTimestamp,
      },
    },
  },
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        if (name === 'users') {
          return {
            id,
            update: mocks.userDocUpdate,
          };
        }
        return {
          id,
        };
      },
    }),
    runTransaction: mocks.runTransaction,
  }),
}));

import { UserCreditService } from '../UserCreditService';

describe('UserCreditService.refundCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existingRefund = false;
    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const transaction = {
        get: async () => ({ exists: mocks.existingRefund }),
        update: mocks.transactionUpdate,
        set: mocks.transactionSet,
      };
      await fn(transaction);
    });
  });

  it('returns true on successful refund with refundKey', async () => {
    const service = new UserCreditService();

    const ok = await service.refundCredits('user-1', 5, {
      refundKey: 'refund-key-1',
      reason: 'generation failed',
    });

    expect(ok).toBe(true);
    expect(mocks.transactionUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.transactionSet).toHaveBeenCalledTimes(1);
    expect(mocks.transactionSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'refund-key-1' }),
      expect.objectContaining({
        refundKey: 'refund-key-1',
        userId: 'user-1',
        amount: 5,
        reason: 'generation failed',
      })
    );
  });

  it('returns true and does not double-credit when refundKey already exists', async () => {
    const service = new UserCreditService();
    mocks.existingRefund = true;

    const ok = await service.refundCredits('user-1', 5, {
      refundKey: 'refund-key-1',
    });

    expect(ok).toBe(true);
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    expect(mocks.transactionSet).not.toHaveBeenCalled();
  });

  it('returns false on Firestore transaction failure', async () => {
    const service = new UserCreditService();
    mocks.runTransaction.mockRejectedValue(new Error('firestore failure'));

    const ok = await service.refundCredits('user-1', 5, {
      refundKey: 'refund-key-1',
    });

    expect(ok).toBe(false);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
