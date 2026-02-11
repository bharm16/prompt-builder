import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockDocRef = {
  id: string;
  __collection: string;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  update: (updates: Record<string, unknown>) => Promise<void>;
  set: (data: Record<string, unknown>) => Promise<void>;
};

type MockUserRecord = {
  credits: number;
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  transactionGet: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionSet: vi.fn(),
  docGet: vi.fn(),
  docUpdate: vi.fn(),
  docSet: vi.fn(),
  increment: vi.fn((operand: number) => ({
    _methodName: 'FieldValue.increment',
    operand,
  })),
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  users: new Map<string, MockUserRecord>(),
  refunds: new Set<string>(),
}));

const applyUserUpdate = (record: MockUserRecord, updates: Record<string, unknown>): void => {
  const creditsUpdate = updates.credits as
    | { _methodName?: string; operand?: number }
    | number
    | undefined;

  if (
    creditsUpdate &&
    typeof creditsUpdate === 'object' &&
    creditsUpdate._methodName === 'FieldValue.increment'
  ) {
    record.credits += Number(creditsUpdate.operand ?? 0);
    return;
  }

  if (typeof creditsUpdate === 'number') {
    record.credits = creditsUpdate;
  }
};

const createDocRef = (collection: string, id: string): MockDocRef => ({
  id,
  __collection: collection,
  get: () => mocks.docGet(collection, id),
  update: (updates: Record<string, unknown>) => mocks.docUpdate(collection, id, updates),
  set: (data: Record<string, unknown>) => mocks.docSet(collection, id, data),
});

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
      doc: (id: string) => createDocRef(name, id),
    }),
    runTransaction: mocks.runTransaction,
  }),
}));

import { UserCreditService } from '../UserCreditService';

describe('UserCreditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.clear();
    mocks.refunds.clear();

    mocks.docGet.mockImplementation(async (collection: string, id: string) => {
      if (collection === 'users') {
        const user = mocks.users.get(id);
        return {
          exists: Boolean(user),
          data: () => (user ? { credits: user.credits } : undefined),
        };
      }

      if (collection === 'credit_refunds') {
        const exists = mocks.refunds.has(id);
        return {
          exists,
          data: () => (exists ? { refundKey: id } : undefined),
        };
      }

      return { exists: false, data: () => undefined };
    });

    mocks.docUpdate.mockImplementation(
      async (collection: string, id: string, updates: Record<string, unknown>) => {
        if (collection !== 'users') return;
        const user = mocks.users.get(id);
        if (!user) {
          throw new Error(`Missing user: ${id}`);
        }
        applyUserUpdate(user, updates);
      }
    );

    mocks.docSet.mockImplementation(
      async (collection: string, id: string, data: Record<string, unknown>) => {
        if (collection === 'users') {
          const credits = typeof data.credits === 'number' ? data.credits : 0;
          mocks.users.set(id, { credits });
          return;
        }

        if (collection === 'credit_refunds') {
          mocks.refunds.add(id);
        }
      }
    );

    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const transaction = {
        get: async (docRef: MockDocRef) => {
          mocks.transactionGet(docRef);
          return docRef.get();
        },
        update: async (docRef: MockDocRef, updates: Record<string, unknown>) => {
          mocks.transactionUpdate(docRef, updates);
          await docRef.update(updates);
        },
        set: async (docRef: MockDocRef, data: Record<string, unknown>) => {
          mocks.transactionSet(docRef, data);
          await docRef.set(data);
        },
      };

      return fn(transaction);
    });
  });

  describe('reserveCredits', () => {
    it('deducts credits when user balance is sufficient', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 100 });

      const ok = await service.reserveCredits('user-1', 30);

      expect(ok).toBe(true);
      expect(mocks.users.get('user-1')?.credits).toBe(70);
      expect(mocks.transactionUpdate).toHaveBeenCalledTimes(1);
    });

    it('returns false without deduction when balance is insufficient', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 10 });

      const ok = await service.reserveCredits('user-1', 30);

      expect(ok).toBe(false);
      expect(mocks.users.get('user-1')?.credits).toBe(10);
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it('returns false for non-existent user', async () => {
      const service = new UserCreditService();

      const ok = await service.reserveCredits('ghost-user', 5);

      expect(ok).toBe(false);
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it('throws when transaction fails', async () => {
      const service = new UserCreditService();
      mocks.runTransaction.mockRejectedValueOnce(new Error('Firestore unavailable'));

      await expect(service.reserveCredits('user-1', 5)).rejects.toThrow(
        'Failed to process credit transaction'
      );
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('refundCredits', () => {
    it('treats zero and negative costs as no-op success', async () => {
      const service = new UserCreditService();

      const zeroResult = await service.refundCredits('user-1', 0, { refundKey: 'a' });
      const negativeResult = await service.refundCredits('user-1', -1, { refundKey: 'b' });

      expect(zeroResult).toBe(true);
      expect(negativeResult).toBe(true);
      expect(mocks.runTransaction).not.toHaveBeenCalled();
      expect(mocks.docUpdate).not.toHaveBeenCalled();
    });

    it('refunds directly when refundKey is absent', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 10 });

      const ok = await service.refundCredits('user-1', 5);

      expect(ok).toBe(true);
      expect(mocks.users.get('user-1')?.credits).toBe(15);
      expect(mocks.docUpdate).toHaveBeenCalledWith(
        'users',
        'user-1',
        expect.objectContaining({
          credits: expect.objectContaining({
            _methodName: 'FieldValue.increment',
            operand: 5,
          }),
        })
      );
    });

    it('returns true on successful idempotent refund with refundKey', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 5 });

      const ok = await service.refundCredits('user-1', 5, {
        refundKey: 'refund-key-1',
        reason: 'generation failed',
      });

      expect(ok).toBe(true);
      expect(mocks.users.get('user-1')?.credits).toBe(10);
      expect(mocks.refunds.has('refund-key-1')).toBe(true);
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

    it('does not double-refund when refund key already exists', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 10 });
      mocks.refunds.add('refund-key-1');

      const ok = await service.refundCredits('user-1', 5, {
        refundKey: 'refund-key-1',
      });

      expect(ok).toBe(true);
      expect(mocks.users.get('user-1')?.credits).toBe(10);
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
      expect(mocks.transactionSet).not.toHaveBeenCalled();
    });

    it('returns false on transaction failure', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 10 });
      mocks.runTransaction.mockRejectedValueOnce(new Error('firestore failure'));

      const ok = await service.refundCredits('user-1', 5, {
        refundKey: 'refund-key-1',
      });

      expect(ok).toBe(false);
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('returns current user credits or 0 if user does not exist', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 77 });

      await expect(service.getBalance('user-1')).resolves.toBe(77);
      await expect(service.getBalance('missing-user')).resolves.toBe(0);
    });
  });

  describe('addCredits', () => {
    it('creates the user document when missing', async () => {
      const service = new UserCreditService();

      await service.addCredits('new-user', 25);

      expect(mocks.users.get('new-user')?.credits).toBe(25);
      expect(mocks.loggerInfo).toHaveBeenCalledWith('Credits added successfully', {
        userId: 'new-user',
        amount: 25,
      });
    });

    it('increments credits for existing user', async () => {
      const service = new UserCreditService();
      mocks.users.set('user-1', { credits: 10 });

      await service.addCredits('user-1', 15);

      expect(mocks.users.get('user-1')?.credits).toBe(25);
    });

    it('throws when addCredits transaction fails', async () => {
      const service = new UserCreditService();
      mocks.runTransaction.mockRejectedValueOnce(new Error('db down'));

      await expect(service.addCredits('user-1', 5)).rejects.toThrow('Transaction failed');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });
});
