import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoreRecord = Record<string, unknown>;

type MockDocRef = {
  id: string;
  get: () => Promise<{ exists: boolean; data: () => StoreRecord | undefined }>;
  set: (data: StoreRecord, options?: { merge?: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  loggerError: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  records: new Map<string, StoreRecord>(),
}));

const createDocRef = (id: string): MockDocRef => ({
  id,
  get: async () => {
    const data = mocks.records.get(id);
    return {
      exists: Boolean(data),
      data: () => (data ? { ...data } : undefined),
    };
  },
  set: async (data: StoreRecord, options?: { merge?: boolean }) => {
    const current = mocks.records.get(id);
    if (options?.merge && current) {
      mocks.records.set(id, {
        ...current,
        ...data,
      });
      return;
    }
    mocks.records.set(id, { ...data });
  },
});

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
  },
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: mocks.serverTimestamp,
      },
    },
  },
  getFirestore: () => ({
    collection: () => ({
      doc: (id: string) => createDocRef(id),
    }),
    runTransaction: mocks.runTransaction,
  }),
}));

import { BillingProfileStore } from '../BillingProfileStore';

describe('BillingProfileStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records.clear();

    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: (docRef: MockDocRef) => docRef.get(),
        set: (docRef: MockDocRef, data: StoreRecord, options?: { merge?: boolean }) =>
          docRef.set(data, options),
      };
      return fn(tx);
    });
  });

  it('returns null when profile does not exist', async () => {
    const store = new BillingProfileStore();

    await expect(store.getProfile('user-1')).resolves.toBeNull();
  });

  it('returns profile when record exists', async () => {
    mocks.records.set('user-1', {
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      createdAtMs: 100,
      updatedAtMs: 100,
    });
    const store = new BillingProfileStore();

    await expect(store.getProfile('user-1')).resolves.toMatchObject({
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    });
  });

  it('creates profile when missing', async () => {
    const store = new BillingProfileStore();

    await store.upsertProfile('user-1', {
      stripeCustomerId: 'cus_123',
      stripeLivemode: false,
    });

    const record = mocks.records.get('user-1');
    expect(record).toBeDefined();
    expect(record).toMatchObject({
      stripeCustomerId: 'cus_123',
      stripeLivemode: false,
    });
    expect(record?.createdAtMs).toEqual(expect.any(Number));
    expect(record?.updatedAtMs).toEqual(expect.any(Number));
  });

  it('merges profile updates when record exists', async () => {
    mocks.records.set('user-1', {
      stripeCustomerId: 'cus_old',
      createdAtMs: 100,
      updatedAtMs: 100,
    });

    const store = new BillingProfileStore();
    await store.upsertProfile('user-1', {
      stripeSubscriptionId: 'sub_new',
      planTier: 'creator',
    });

    expect(mocks.records.get('user-1')).toMatchObject({
      stripeCustomerId: 'cus_old',
      stripeSubscriptionId: 'sub_new',
      planTier: 'creator',
      createdAtMs: 100,
    });
    expect(mocks.records.get('user-1')?.updatedAtMs).toEqual(expect.any(Number));
  });

  it('logs and rethrows transaction errors', async () => {
    const store = new BillingProfileStore();
    mocks.runTransaction.mockRejectedValueOnce(new Error('db down'));

    await expect(
      store.upsertProfile('user-1', {
        stripeCustomerId: 'cus_123',
      })
    ).rejects.toThrow('db down');

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to upsert billing profile',
      expect.any(Error),
      expect.objectContaining({
        userId: 'user-1',
      })
    );
  });
});
