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
  fieldDelete: vi.fn(() => ({ _methodName: 'FieldValue.delete' })),
  records: new Map<string, StoreRecord>(),
  failSetDocId: null as string | null,
}));

const createDocRef = (id: string): MockDocRef => ({
  id,
  get: async () => {
    const record = mocks.records.get(id);
    return {
      exists: Boolean(record),
      data: () => (record ? { ...record } : undefined),
    };
  },
  update: async (data: StoreRecord) => {
    const current = mocks.records.get(id);
    if (!current) {
      throw new Error(`Missing webhook event doc: ${id}`);
    }

    const next = { ...current, ...data };
    if ((next.lastError as Record<string, unknown> | undefined)?._methodName === 'FieldValue.delete') {
      delete next.lastError;
    }
    mocks.records.set(id, next);
  },
  set: async (data: StoreRecord, options?: { merge?: boolean }) => {
    if (mocks.failSetDocId === id) {
      throw new Error('db unavailable');
    }
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
        delete: mocks.fieldDelete,
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

import { StripeWebhookEventStore } from '../StripeWebhookEventStore';

describe('StripeWebhookEventStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records.clear();
    mocks.failSetDocId = null;

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

  describe('claimEvent', () => {
    it('claims new events as processing', async () => {
      const store = new StripeWebhookEventStore();

      const result = await store.claimEvent('evt_1', {
        type: 'invoice.paid',
        livemode: false,
      });

      expect(result).toEqual({ state: 'claimed' });
      expect(mocks.records.get('evt_1')).toMatchObject({
        status: 'processing',
        type: 'invoice.paid',
        livemode: false,
        attempt: 1,
      });
    });

    it('returns processed for already processed events', async () => {
      mocks.records.set('evt_1', {
        status: 'processed',
        type: 'invoice.paid',
        livemode: false,
        attempt: 1,
      });
      const store = new StripeWebhookEventStore();

      const result = await store.claimEvent('evt_1', {
        type: 'invoice.paid',
        livemode: false,
      });

      expect(result).toEqual({ state: 'processed' });
    });

    it('returns in_progress for non-stale processing events', async () => {
      mocks.records.set('evt_1', {
        status: 'processing',
        type: 'invoice.paid',
        livemode: false,
        attempt: 1,
        updatedAtMs: Date.now(),
      });
      const store = new StripeWebhookEventStore(60_000);

      const result = await store.claimEvent('evt_1', {
        type: 'invoice.paid',
        livemode: false,
      });

      expect(result).toEqual({ state: 'in_progress' });
    });

    it('reclaims stale processing events and increments attempts', async () => {
      mocks.records.set('evt_1', {
        status: 'processing',
        type: 'invoice.paid',
        livemode: false,
        attempt: 2,
        updatedAtMs: Date.now() - 5_000,
        lastError: 'old',
      });
      const store = new StripeWebhookEventStore(1_000);

      const result = await store.claimEvent('evt_1', {
        type: 'invoice.paid',
        livemode: false,
      });

      expect(result).toEqual({ state: 'claimed' });
      expect(mocks.records.get('evt_1')).toMatchObject({
        status: 'processing',
        attempt: 3,
      });
      expect(mocks.records.get('evt_1')).not.toHaveProperty('lastError');
    });
  });

  describe('event status mutations', () => {
    it('marks events processed', async () => {
      mocks.records.set('evt_1', {
        status: 'processing',
        attempt: 1,
      });
      const store = new StripeWebhookEventStore();

      await store.markProcessed('evt_1');

      expect(mocks.records.get('evt_1')).toMatchObject({
        status: 'processed',
      });
    });

    it('marks events failed with error message', async () => {
      mocks.records.set('evt_1', {
        status: 'processing',
        attempt: 1,
      });
      const store = new StripeWebhookEventStore();

      await store.markFailed('evt_1', new Error('handler crashed'));

      expect(mocks.records.get('evt_1')).toMatchObject({
        status: 'failed',
        lastError: 'handler crashed',
      });
    });

    it('swallows markFailed persistence errors and logs', async () => {
      const store = new StripeWebhookEventStore();
      mocks.failSetDocId = 'evt_1';

      await expect(store.markFailed('evt_1', new Error('handler crashed'))).resolves.toBeUndefined();
      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Failed to record Stripe webhook failure',
        expect.any(Error),
        expect.objectContaining({ eventId: 'evt_1' })
      );
    });
  });
});
