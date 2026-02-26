import { beforeEach, describe, expect, it, vi } from 'vitest';

type UserRecord = {
  credits: number;
  starterGrantCredits?: number;
  starterGrantGrantedAtMs?: number;
};

type TransactionRecord = {
  id: string;
  data: Record<string, unknown>;
};

type MockDocRef = {
  id: string;
  __collection: string;
  __userId?: string;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  update: (updates: Record<string, unknown>) => Promise<void>;
  set: (data: Record<string, unknown>) => Promise<void>;
  collection: (name: string) => {
    doc: (id?: string) => MockDocRef;
    add: (data: Record<string, unknown>) => Promise<{ id: string }>;
    orderBy: (_field: string, direction: 'asc' | 'desc') => {
      limit: (count: number) => {
        get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
      };
    };
  };
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  increment: vi.fn((operand: number) => ({
    _methodName: 'FieldValue.increment',
    operand,
  })),
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  users: new Map<string, UserRecord>(),
  refunds: new Set<string>(),
  transactionsByUser: new Map<string, TransactionRecord[]>(),
  transactionIdCounter: 0,
}));

const nextTransactionId = (): string => {
  mocks.transactionIdCounter += 1;
  return `txn_${mocks.transactionIdCounter}`;
};

const applyIncrement = (
  currentValue: number,
  nextValue: unknown
): number => {
  if (
    nextValue &&
    typeof nextValue === 'object' &&
    (nextValue as { _methodName?: string })._methodName === 'FieldValue.increment'
  ) {
    return currentValue + Number((nextValue as { operand?: number }).operand ?? 0);
  }
  if (typeof nextValue === 'number') {
    return nextValue;
  }
  return currentValue;
};

const ensureUserTransactions = (userId: string): TransactionRecord[] => {
  const existing = mocks.transactionsByUser.get(userId);
  if (existing) return existing;
  const next: TransactionRecord[] = [];
  mocks.transactionsByUser.set(userId, next);
  return next;
};

const createDocRef = (collection: string, id: string, userId?: string): MockDocRef => ({
  id,
  __collection: collection,
  ...(userId ? { __userId: userId } : {}),
  get: async () => {
    if (collection === 'users') {
      const user = mocks.users.get(id);
      return {
        exists: Boolean(user),
        data: () => (user ? { ...user } : undefined),
      };
    }

    if (collection === 'credit_refunds') {
      const exists = mocks.refunds.has(id);
      return {
        exists,
        data: () => (exists ? { refundKey: id } : undefined),
      };
    }

    if (collection === 'credit_transactions' && userId) {
      const transactions = ensureUserTransactions(userId);
      const tx = transactions.find((entry) => entry.id === id);
      return {
        exists: Boolean(tx),
        data: () => (tx ? { ...tx.data } : undefined),
      };
    }

    return {
      exists: false,
      data: () => undefined,
    };
  },
  update: async (updates: Record<string, unknown>) => {
    if (collection !== 'users') {
      throw new Error(`Unsupported update collection ${collection}`);
    }

    const user = mocks.users.get(id);
    if (!user) {
      throw new Error(`Missing user: ${id}`);
    }

    user.credits = applyIncrement(user.credits, updates.credits);
    if (typeof updates.starterGrantCredits === 'number') {
      user.starterGrantCredits = updates.starterGrantCredits;
    }
    if (typeof updates.starterGrantGrantedAtMs === 'number') {
      user.starterGrantGrantedAtMs = updates.starterGrantGrantedAtMs;
    }
  },
  set: async (data: Record<string, unknown>) => {
    if (collection === 'users') {
      const existing = mocks.users.get(id);
      const next: UserRecord = {
        credits:
          typeof data.credits === 'number'
            ? data.credits
            : existing?.credits ?? 0,
        ...(typeof data.starterGrantCredits === 'number'
          ? { starterGrantCredits: data.starterGrantCredits }
          : existing?.starterGrantCredits !== undefined
            ? { starterGrantCredits: existing.starterGrantCredits }
            : {}),
        ...(typeof data.starterGrantGrantedAtMs === 'number'
          ? { starterGrantGrantedAtMs: data.starterGrantGrantedAtMs }
          : existing?.starterGrantGrantedAtMs !== undefined
            ? { starterGrantGrantedAtMs: existing.starterGrantGrantedAtMs }
            : {}),
      };
      mocks.users.set(id, next);
      return;
    }

    if (collection === 'credit_refunds') {
      mocks.refunds.add(id);
      return;
    }

    if (collection === 'credit_transactions' && userId) {
      const transactions = ensureUserTransactions(userId);
      const existingIndex = transactions.findIndex((entry) => entry.id === id);
      const record: TransactionRecord = {
        id,
        data: { ...data },
      };
      if (existingIndex >= 0) {
        transactions[existingIndex] = record;
      } else {
        transactions.push(record);
      }
      return;
    }

    throw new Error(`Unsupported set collection ${collection}`);
  },
  collection: (name: string) => {
    if (collection !== 'users') {
      throw new Error(`Nested collections only supported under users. Received ${collection}`);
    }

    if (name !== 'credit_transactions') {
      throw new Error(`Unsupported nested collection ${name}`);
    }

    return {
      doc: (nestedId?: string) => createDocRef('credit_transactions', nestedId ?? nextTransactionId(), id),
      add: async (data: Record<string, unknown>) => {
        const nestedId = nextTransactionId();
        await createDocRef('credit_transactions', nestedId, id).set(data);
        return { id: nestedId };
      },
      orderBy: (_field: string, direction: 'asc' | 'desc') => ({
        limit: (count: number) => ({
          get: async () => {
            const rows = [...ensureUserTransactions(id)]
              .sort((left, right) => {
                const leftMs = Number(left.data.createdAtMs ?? 0);
                const rightMs = Number(right.data.createdAtMs ?? 0);
                if (direction === 'asc') {
                  return leftMs - rightMs;
                }
                return rightMs - leftMs;
              })
              .slice(0, count)
              .map((entry) => ({
                id: entry.id,
                data: () => ({ ...entry.data }),
              }));
            return { docs: rows };
          },
        }),
      }),
    };
  },
});

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
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
    mocks.transactionsByUser.clear();
    mocks.transactionIdCounter = 0;

    mocks.runTransaction.mockImplementation(async (fn: (transaction: {
      get: (docRef: MockDocRef) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      update: (docRef: MockDocRef, updates: Record<string, unknown>) => Promise<void>;
      set: (docRef: MockDocRef, data: Record<string, unknown>) => Promise<void>;
    }) => Promise<unknown>) => {
      const transaction = {
        get: async (docRef: MockDocRef) => docRef.get(),
        update: async (docRef: MockDocRef, updates: Record<string, unknown>) => {
          await docRef.update(updates);
        },
        set: async (docRef: MockDocRef, data: Record<string, unknown>) => {
          await docRef.set(data);
        },
      };

      return fn(transaction);
    });
  });

  it('reserveCredits deducts balance and writes a reserve transaction', async () => {
    const service = new UserCreditService();
    mocks.users.set('user-1', { credits: 100 });

    const ok = await service.reserveCredits('user-1', 5);

    expect(ok).toBe(true);
    expect(mocks.users.get('user-1')?.credits).toBe(95);
    const transactions = mocks.transactionsByUser.get('user-1') ?? [];
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.data).toEqual(
      expect.objectContaining({
        type: 'reserve',
        amount: -5,
        source: 'generation',
      })
    );
  });

  it('refundCredits with refundKey is idempotent and writes a single transaction', async () => {
    const service = new UserCreditService();
    mocks.users.set('user-1', { credits: 10 });

    await service.refundCredits('user-1', 5, {
      refundKey: 'refund-1',
      reason: 'generation failed',
    });
    await service.refundCredits('user-1', 5, {
      refundKey: 'refund-1',
      reason: 'generation failed',
    });

    expect(mocks.users.get('user-1')?.credits).toBe(15);
    expect(mocks.refunds.has('refund-1')).toBe(true);
    const transactions = mocks.transactionsByUser.get('user-1') ?? [];
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.data).toEqual(
      expect.objectContaining({
        type: 'refund',
        amount: 5,
        source: 'generation',
        reason: 'generation failed',
        referenceId: 'refund-1',
      })
    );
  });

  it('addCredits creates user when missing and writes an add transaction', async () => {
    const service = new UserCreditService();

    await service.addCredits('new-user', 25, {
      source: 'stripe_checkout',
      reason: 'one_time_credit_pack',
      referenceId: 'cs_1',
    });

    expect(mocks.users.get('new-user')?.credits).toBe(25);
    const transactions = mocks.transactionsByUser.get('new-user') ?? [];
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.data).toEqual(
      expect.objectContaining({
        type: 'add',
        amount: 25,
        source: 'stripe_checkout',
        reason: 'one_time_credit_pack',
        referenceId: 'cs_1',
      })
    );
  });

  it('ensureStarterGrant grants once and stays idempotent', async () => {
    const service = new UserCreditService();

    const first = await service.ensureStarterGrant('firebase-user', 25);
    const second = await service.ensureStarterGrant('firebase-user', 25);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(mocks.users.get('firebase-user')).toEqual(
      expect.objectContaining({
        credits: 25,
        starterGrantCredits: 25,
      })
    );
    const transactions = mocks.transactionsByUser.get('firebase-user') ?? [];
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.data).toEqual(
      expect.objectContaining({
        type: 'starter_grant',
        amount: 25,
      })
    );
  });

  it('ensureStarterGrant skips API-key users', async () => {
    const service = new UserCreditService();

    const granted = await service.ensureStarterGrant('api-key:dev-key', 25);

    expect(granted).toBe(false);
    expect(mocks.users.size).toBe(0);
    expect(mocks.transactionsByUser.size).toBe(0);
  });

  it('listCreditTransactions returns newest-first with bounded limit', async () => {
    const service = new UserCreditService();
    const userId = 'user-1';

    mocks.users.set(userId, { credits: 10 });
    ensureUserTransactions(userId).push(
      {
        id: 'txn_old',
        data: {
          type: 'add',
          amount: 5,
          source: 'billing',
          createdAtMs: 100,
        },
      },
      {
        id: 'txn_new',
        data: {
          type: 'reserve',
          amount: -4,
          source: 'generation',
          createdAtMs: 200,
        },
      }
    );

    const transactions = await service.listCreditTransactions(userId, 1);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.id).toBe('txn_new');
  });

  it('getStarterGrantInfo returns starter metadata from the user document', async () => {
    const service = new UserCreditService();
    mocks.users.set('user-1', {
      credits: 25,
      starterGrantCredits: 25,
      starterGrantGrantedAtMs: 1700000000000,
    });

    const info = await service.getStarterGrantInfo('user-1');

    expect(info).toEqual({
      starterGrantCredits: 25,
      starterGrantGrantedAtMs: 1700000000000,
    });
  });
});
