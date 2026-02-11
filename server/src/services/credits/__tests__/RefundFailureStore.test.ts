import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoreRecord = Record<string, unknown>;

type MockDocRef = {
  id: string;
  get: () => Promise<{ exists: boolean; data: () => StoreRecord | undefined }>;
  update: (data: StoreRecord) => Promise<void>;
  set: (data: StoreRecord, options?: { merge?: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  loggerError: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  records: new Map<string, StoreRecord>(),
  queryGet: vi.fn(),
}));

const clone = (value: StoreRecord): StoreRecord => ({ ...value });

const createDocRef = (id: string): MockDocRef => ({
  id,
  get: async () => {
    const record = mocks.records.get(id);
    return {
      exists: Boolean(record),
      data: () => (record ? clone(record) : undefined),
    };
  },
  update: async (data: StoreRecord) => {
    const current = mocks.records.get(id);
    if (!current) {
      throw new Error(`Missing doc: ${id}`);
    }
    mocks.records.set(id, {
      ...current,
      ...data,
    });
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
    mocks.records.set(id, clone(data));
  },
});

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: mocks.loggerError,
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
      where: (_field: string, _operator: string, value: unknown) => ({
        limit: (scanLimit: number) => ({
          get: () => mocks.queryGet(value, scanLimit),
        }),
      }),
    }),
    runTransaction: mocks.runTransaction,
  }),
}));

import { RefundFailureStore } from '../RefundFailureStore';

describe('RefundFailureStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records.clear();

    mocks.queryGet.mockImplementation(async (value: unknown, scanLimit: number) => {
      const docs = Array.from(mocks.records.entries())
        .filter(([, record]) => record.status === value)
        .slice(0, scanLimit)
        .map(([id, record]) => ({
          id,
          data: () => clone(record),
        }));

      return {
        empty: docs.length === 0,
        docs,
      };
    });

    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: (docRef: MockDocRef) => docRef.get(),
        update: (docRef: MockDocRef, data: StoreRecord) => docRef.update(data),
        set: (docRef: MockDocRef, data: StoreRecord, options?: { merge?: boolean }) =>
          docRef.set(data, options),
      };
      return fn(tx);
    });
  });

  describe('upsertFailure', () => {
    it('creates a pending failure record for a new refund key', async () => {
      const store = new RefundFailureStore();

      await store.upsertFailure({
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 12,
        reason: 'generation failed',
      });

      const record = mocks.records.get('refund-1');
      expect(record).toBeDefined();
      expect(record).toMatchObject({
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 12,
        status: 'pending',
        attempts: 0,
        reason: 'generation failed',
      });
    });

    it('updates non-resolved records back to pending with latest values', async () => {
      mocks.records.set('refund-1', {
        refundKey: 'refund-1',
        userId: 'old-user',
        amount: 1,
        status: 'processing',
        attempts: 4,
        updatedAtMs: 100,
      });

      const store = new RefundFailureStore();
      await store.upsertFailure({
        refundKey: 'refund-1',
        userId: 'user-2',
        amount: 20,
        lastError: 'retry exhausted',
      });

      expect(mocks.records.get('refund-1')).toMatchObject({
        refundKey: 'refund-1',
        userId: 'user-2',
        amount: 20,
        status: 'pending',
        attempts: 4,
        lastError: 'retry exhausted',
      });
    });

    it('does not mutate resolved records', async () => {
      mocks.records.set('refund-1', {
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 12,
        status: 'resolved',
        attempts: 3,
        updatedAtMs: 100,
      });

      const store = new RefundFailureStore();
      await store.upsertFailure({
        refundKey: 'refund-1',
        userId: 'user-2',
        amount: 99,
      });

      expect(mocks.records.get('refund-1')).toMatchObject({
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 12,
        status: 'resolved',
      });
    });

    it('logs and rethrows when transaction fails', async () => {
      const store = new RefundFailureStore();
      mocks.runTransaction.mockRejectedValueOnce(new Error('firestore down'));

      await expect(
        store.upsertFailure({
          refundKey: 'refund-1',
          userId: 'user-1',
          amount: 12,
        })
      ).rejects.toThrow('firestore down');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('claimNextPending', () => {
    it('returns null when no pending records exist', async () => {
      const store = new RefundFailureStore();
      await expect(store.claimNextPending(5, 10)).resolves.toBeNull();
    });

    it('claims the oldest pending record and marks it processing', async () => {
      mocks.records.set('refund-newer', {
        refundKey: 'refund-newer',
        userId: 'user-2',
        amount: 20,
        status: 'pending',
        attempts: 0,
        createdAtMs: 200,
        updatedAtMs: 200,
      });
      mocks.records.set('refund-older', {
        refundKey: 'refund-older',
        userId: 'user-1',
        amount: 10,
        status: 'pending',
        attempts: 1,
        createdAtMs: 100,
        updatedAtMs: 100,
      });

      const store = new RefundFailureStore();
      const claimed = await store.claimNextPending(5, 10);

      expect(claimed).toMatchObject({
        refundKey: 'refund-older',
        userId: 'user-1',
        amount: 10,
        status: 'processing',
        attempts: 1,
      });
      expect(mocks.records.get('refund-older')?.status).toBe('processing');
    });

    it('escalates records that already reached max attempts', async () => {
      mocks.records.set('refund-1', {
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 10,
        status: 'pending',
        attempts: 5,
        createdAtMs: 100,
        updatedAtMs: 100,
      });

      const store = new RefundFailureStore();
      const claimed = await store.claimNextPending(5, 10);

      expect(claimed).toBeNull();
      expect(mocks.records.get('refund-1')).toMatchObject({
        status: 'escalated',
        attempts: 5,
      });
    });

    it('returns null when pending query fails', async () => {
      const store = new RefundFailureStore();
      mocks.queryGet.mockRejectedValueOnce(new Error('query failed'));

      const claimed = await store.claimNextPending(5, 10);

      expect(claimed).toBeNull();
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('record status mutations', () => {
    it('marks records resolved', async () => {
      mocks.records.set('refund-1', {
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 10,
        status: 'pending',
        attempts: 1,
      });
      const store = new RefundFailureStore();

      await store.markResolved('refund-1');

      expect(mocks.records.get('refund-1')).toMatchObject({
        status: 'resolved',
      });
    });

    it('releases records for retry and increments attempts', async () => {
      mocks.records.set('refund-1', {
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 10,
        status: 'processing',
        attempts: 2,
      });
      const store = new RefundFailureStore();

      await store.releaseForRetry('refund-1', 'temporary failure');

      expect(mocks.records.get('refund-1')).toMatchObject({
        status: 'pending',
        attempts: 3,
        lastError: 'temporary failure',
      });
    });

    it('marks records escalated and increments attempts', async () => {
      mocks.records.set('refund-1', {
        refundKey: 'refund-1',
        userId: 'user-1',
        amount: 10,
        status: 'processing',
        attempts: 4,
      });
      const store = new RefundFailureStore();

      await store.markEscalated('refund-1', 'permanent failure');

      expect(mocks.records.get('refund-1')).toMatchObject({
        status: 'escalated',
        attempts: 5,
        lastError: 'permanent failure',
      });
    });

    it('ignores retry/escalation calls for missing records', async () => {
      const store = new RefundFailureStore();

      await store.releaseForRetry('missing', 'x');
      await store.markEscalated('missing', 'y');

      expect(mocks.records.has('missing')).toBe(false);
    });
  });
});
