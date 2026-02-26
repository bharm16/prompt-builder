import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvergenceError } from '../../errors';

type StoreRecord = Record<string, unknown>;
type CollectionName = 'users' | 'credit_reservations' | 'credit_debits';

type MockDocRef = {
  id: string;
  __collection: CollectionName;
  get: () => Promise<{ exists: boolean; data: () => StoreRecord | undefined }>;
  set: (data: StoreRecord) => Promise<void>;
  update: (data: StoreRecord) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  increment: vi.fn((operand: number) => ({
    _methodName: 'FieldValue.increment',
    operand,
  })),
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  timestampFromDate: vi.fn((value: Date) => ({ _methodName: 'Timestamp.fromDate', value })),
  users: new Map<string, StoreRecord>(),
  reservations: new Map<string, StoreRecord>(),
  debits: new Map<string, StoreRecord>(),
  debitCounter: 0,
}));

const applyIncrementUpdate = (
  current: StoreRecord,
  updates: StoreRecord
): StoreRecord => {
  const next = { ...current, ...updates };
  const creditsUpdate = updates.credits as
    | { _methodName?: string; operand?: number }
    | number
    | undefined;
  if (
    creditsUpdate &&
    typeof creditsUpdate === 'object' &&
    creditsUpdate._methodName === 'FieldValue.increment'
  ) {
    const currentCredits = typeof current.credits === 'number' ? current.credits : 0;
    next.credits = currentCredits + Number(creditsUpdate.operand ?? 0);
  }
  return next;
};

const getStore = (collection: CollectionName): Map<string, StoreRecord> => {
  if (collection === 'users') return mocks.users;
  if (collection === 'credit_reservations') return mocks.reservations;
  return mocks.debits;
};

const createDocRef = (collection: CollectionName, id: string): MockDocRef => ({
  id,
  __collection: collection,
  get: async () => {
    const store = getStore(collection);
    const value = store.get(id);
    return {
      exists: Boolean(value),
      data: () => (value ? { ...value } : undefined),
    };
  },
  set: async (data: StoreRecord) => {
    getStore(collection).set(id, { ...data });
  },
  update: async (data: StoreRecord) => {
    const store = getStore(collection);
    const current = store.get(id);
    if (!current) {
      throw new Error(`Missing ${collection}:${id}`);
    }
    store.set(id, applyIncrementUpdate(current, data));
  },
});

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'reservation-fixed-id'),
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  admin: {
    firestore: {
      FieldValue: {
        increment: mocks.increment,
        serverTimestamp: mocks.serverTimestamp,
      },
      Timestamp: {
        fromDate: mocks.timestampFromDate,
      },
    },
  },
  getFirestore: () => ({
    collection: (name: CollectionName) => ({
      doc: (id?: string) => {
        const resolvedId = id ?? `debit-${++mocks.debitCounter}`;
        return createDocRef(name, resolvedId);
      },
    }),
    runTransaction: mocks.runTransaction,
  }),
}));

import { FirestoreCreditsService } from '../CreditsService';

describe('FirestoreCreditsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.clear();
    mocks.reservations.clear();
    mocks.debits.clear();
    mocks.debitCounter = 0;

    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: (docRef: MockDocRef) => docRef.get(),
        update: (docRef: MockDocRef, data: StoreRecord) => docRef.update(data),
        set: (docRef: MockDocRef, data: StoreRecord) => docRef.set(data),
      };
      return fn(tx);
    });
  });

  describe('getBalance', () => {
    it('returns current balance or zero when missing', async () => {
      const service = new FirestoreCreditsService();
      mocks.users.set('user-1', { credits: 42 });

      await expect(service.getBalance('user-1')).resolves.toBe(42);
      await expect(service.getBalance('missing')).resolves.toBe(0);
    });
  });

  describe('reserve', () => {
    it('reserves credits and creates pending reservation', async () => {
      const service = new FirestoreCreditsService();
      mocks.users.set('user-1', { credits: 100 });

      const reservation = await service.reserve('user-1', 25);

      expect(reservation).toMatchObject({
        id: 'reservation-fixed-id',
        userId: 'user-1',
        amount: 25,
        status: 'pending',
      });
      expect(mocks.users.get('user-1')?.credits).toBe(75);
      expect(mocks.reservations.get('reservation-fixed-id')).toMatchObject({
        status: 'pending',
      });
    });

    it('throws INSUFFICIENT_CREDITS when user is missing', async () => {
      const service = new FirestoreCreditsService();

      await expect(service.reserve('missing', 10)).rejects.toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        details: {
          required: 10,
          available: 0,
        },
      });
    });

    it('throws INSUFFICIENT_CREDITS when balance is insufficient', async () => {
      const service = new FirestoreCreditsService();
      mocks.users.set('user-1', { credits: 5 });

      await expect(service.reserve('user-1', 10)).rejects.toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        details: {
          required: 10,
          available: 5,
        },
      });
    });

    it('throws normalized error when transaction fails unexpectedly', async () => {
      const service = new FirestoreCreditsService();
      mocks.runTransaction.mockRejectedValueOnce(new Error('db down'));

      await expect(service.reserve('user-1', 10)).rejects.toThrow('Failed to reserve credits');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    it('commits pending reservations', async () => {
      const service = new FirestoreCreditsService();
      mocks.reservations.set('reservation-1', { status: 'pending' });

      await service.commit('reservation-1');

      expect(mocks.reservations.get('reservation-1')).toMatchObject({
        status: 'committed',
      });
      expect(mocks.loggerInfo).toHaveBeenCalledWith('Credit reservation committed', {
        reservationId: 'reservation-1',
      });
    });

    it('warns and returns when reservation is missing', async () => {
      const service = new FirestoreCreditsService();

      await expect(service.commit('missing')).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it('warns and returns when reservation is not pending', async () => {
      const service = new FirestoreCreditsService();
      mocks.reservations.set('reservation-1', { status: 'refunded' });

      await expect(service.commit('reservation-1')).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('refunds pending reservation and restores user credits', async () => {
      const service = new FirestoreCreditsService();
      mocks.users.set('user-1', { credits: 10 });
      mocks.reservations.set('reservation-1', {
        status: 'pending',
        userId: 'user-1',
        amount: 5,
      });

      await service.refund('reservation-1');

      expect(mocks.users.get('user-1')?.credits).toBe(15);
      expect(mocks.reservations.get('reservation-1')).toMatchObject({
        status: 'refunded',
      });
    });

    it('warns and returns for missing reservation', async () => {
      const service = new FirestoreCreditsService();

      await expect(service.refund('missing')).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it('warns and returns for non-pending reservation', async () => {
      const service = new FirestoreCreditsService();
      mocks.reservations.set('reservation-1', {
        status: 'committed',
        userId: 'user-1',
        amount: 5,
      });

      await expect(service.refund('reservation-1')).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it('throws normalized error when refund transaction fails', async () => {
      const service = new FirestoreCreditsService();
      mocks.runTransaction.mockRejectedValueOnce(new Error('db down'));

      await expect(service.refund('reservation-1')).rejects.toThrow('Failed to refund credits');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('debit', () => {
    it('debits credits and writes an audit record', async () => {
      const service = new FirestoreCreditsService();
      mocks.users.set('user-1', { credits: 50 });

      await service.debit('user-1', 20, 'generation');

      expect(mocks.users.get('user-1')?.credits).toBe(30);
      expect(Array.from(mocks.debits.values())[0]).toMatchObject({
        userId: 'user-1',
        amount: 20,
        reason: 'generation',
      });
    });

    it('throws INSUFFICIENT_CREDITS for missing users', async () => {
      const service = new FirestoreCreditsService();

      await expect(service.debit('missing', 5, 'generation')).rejects.toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        details: {
          required: 5,
          available: 0,
        },
      });
    });

    it('throws INSUFFICIENT_CREDITS when balance is too low', async () => {
      const service = new FirestoreCreditsService();
      mocks.users.set('user-1', { credits: 3 });

      await expect(service.debit('user-1', 5, 'generation')).rejects.toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        details: {
          required: 5,
          available: 3,
        },
      });
    });

    it('throws normalized error on unexpected transaction failure', async () => {
      const service = new FirestoreCreditsService();
      mocks.runTransaction.mockRejectedValueOnce(new Error('db down'));

      await expect(service.debit('user-1', 5, 'generation')).rejects.toThrow(
        'Failed to debit credits'
      );
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });
});
