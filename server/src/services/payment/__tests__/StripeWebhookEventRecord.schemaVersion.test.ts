import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Forward-compatibility regression tests for StripeWebhookEventRecord.
 *
 * Invariants:
 *   1. New writes via StripeWebhookEventStore.claimEvent include `schemaVersion: 1`.
 *   2. Reading a legacy record (no `schemaVersion`) parses without error
 *      (i.e., claimEvent succeeds against pre-migration data).
 *   3. Reading a record with `schemaVersion: 1` parses without error.
 *   4. Reading a record with `schemaVersion: 2` (future) throws a Zod error
 *      so old pods fail loudly rather than silently mis-parsing newer shapes.
 */

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
  serverTimestamp: vi.fn(() => ({ _methodName: "FieldValue.serverTimestamp" })),
  fieldDelete: vi.fn(() => ({ _methodName: "FieldValue.delete" })),
  records: new Map<string, StoreRecord>(),
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
    if (
      (next.lastError as Record<string, unknown> | undefined)?._methodName ===
      "FieldValue.delete"
    ) {
      delete next.lastError;
    }
    mocks.records.set(id, next);
  },
  set: async (data: StoreRecord, options?: { merge?: boolean }) => {
    const current = mocks.records.get(id);
    if (options?.merge && current) {
      mocks.records.set(id, { ...current, ...data });
      return;
    }
    mocks.records.set(id, { ...data });
  },
});

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    error: mocks.loggerError,
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    })),
  },
}));

vi.mock("@infrastructure/firebaseAdmin", () => ({
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

import {
  StripeWebhookEventStore,
  parseStripeWebhookEventSchemaVersion,
} from "../StripeWebhookEventStore";

describe("StripeWebhookEventRecord schemaVersion forward-compat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records.clear();

    mocks.runTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: (docRef: MockDocRef) => docRef.get(),
          update: (docRef: MockDocRef, data: StoreRecord) =>
            docRef.update(data),
          set: (
            docRef: MockDocRef,
            data: StoreRecord,
            options?: { merge?: boolean },
          ) => docRef.set(data, options),
        };
        return fn(tx);
      },
    );
  });

  it("claimEvent writes schemaVersion: 1 onto a new record", async () => {
    const store = new StripeWebhookEventStore();

    const result = await store.claimEvent("evt_new", {
      type: "invoice.paid",
      livemode: false,
    });

    expect(result).toEqual({ state: "claimed" });
    expect(mocks.records.get("evt_new")).toMatchObject({
      schemaVersion: 1,
      status: "processing",
      attempt: 1,
    });
  });

  it("claimEvent on a legacy stale processing record (no schemaVersion) reclaims and stamps schemaVersion: 1", async () => {
    // Legacy record predates the schemaVersion migration — no field present.
    mocks.records.set("evt_legacy", {
      status: "processing",
      type: "invoice.paid",
      livemode: false,
      attempt: 1,
      updatedAtMs: Date.now() - 60_000,
    });

    const store = new StripeWebhookEventStore(1_000); // 1s TTL → record is stale

    const result = await store.claimEvent("evt_legacy", {
      type: "invoice.paid",
      livemode: false,
    });

    expect(result).toEqual({ state: "claimed" });
    expect(mocks.records.get("evt_legacy")).toMatchObject({
      schemaVersion: 1,
      attempt: 2,
    });
  });

  it("claimEvent on a v1 already-processed record returns processed without throwing", async () => {
    mocks.records.set("evt_v1", {
      schemaVersion: 1,
      status: "processed",
      type: "invoice.paid",
      livemode: false,
      attempt: 1,
    });
    const store = new StripeWebhookEventStore();

    const result = await store.claimEvent("evt_v1", {
      type: "invoice.paid",
      livemode: false,
    });

    expect(result).toEqual({ state: "processed" });
  });

  it("parseStripeWebhookEventSchemaVersion accepts undefined (legacy records)", () => {
    expect(parseStripeWebhookEventSchemaVersion(undefined)).toBeUndefined();
  });

  it("parseStripeWebhookEventSchemaVersion accepts the literal 1", () => {
    expect(parseStripeWebhookEventSchemaVersion(1)).toBe(1);
  });

  it("parseStripeWebhookEventSchemaVersion rejects schemaVersion: 2 (future) so older pods fail loudly", () => {
    expect(() => parseStripeWebhookEventSchemaVersion(2)).toThrow();
  });
});
