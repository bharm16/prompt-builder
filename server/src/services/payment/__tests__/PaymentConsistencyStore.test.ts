import { beforeEach, describe, expect, it, vi } from "vitest";

type StoreRecord = Record<string, unknown>;

type MockDocRef = {
  id: string;
  ref: { id: string; update: (data: StoreRecord) => Promise<void> };
  get: () => Promise<{ exists: boolean; data: () => StoreRecord | undefined }>;
  update: (data: StoreRecord) => Promise<void>;
  set: (data: StoreRecord, options?: { merge?: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: "FieldValue.serverTimestamp" })),
  fieldDelete: vi.fn(() => ({ _methodName: "FieldValue.delete" })),
  unresolvedRecords: new Map<string, StoreRecord>(),
  repairRecords: new Map<string, StoreRecord>(),
  failNextRead: false,
}));

const clone = (value: StoreRecord): StoreRecord => ({ ...value });

const stripDeleteSentinels = (data: StoreRecord): StoreRecord => {
  const next: StoreRecord = {};
  for (const [key, value] of Object.entries(data)) {
    const sentinel = value as { _methodName?: string } | undefined;
    if (sentinel?._methodName === "FieldValue.delete") continue;
    next[key] = value;
  }
  return next;
};

const createDocRef = (
  store: Map<string, StoreRecord>,
  id: string,
): MockDocRef => {
  const refUpdate = async (data: StoreRecord) => {
    const current = store.get(id);
    if (!current) throw new Error(`Missing doc: ${id}`);
    store.set(id, stripDeleteSentinels({ ...current, ...data }));
  };
  return {
    id,
    ref: { id, update: refUpdate },
    get: async () => {
      const record = store.get(id);
      return {
        exists: Boolean(record),
        data: () => (record ? clone(record) : undefined),
      };
    },
    update: refUpdate,
    set: async (data: StoreRecord, options?: { merge?: boolean }) => {
      const current = store.get(id);
      if (options?.merge && current) {
        store.set(id, { ...current, ...data });
        return;
      }
      store.set(id, clone(data));
    },
  };
};

vi.mock("@services/firestore/FirestoreCircuitExecutor", () => ({
  getFirestoreCircuitExecutor: () => ({
    executeRead: async (_label: string, fn: () => Promise<unknown>) => {
      if (mocks.failNextRead) {
        mocks.failNextRead = false;
        throw new Error("circuit open");
      }
      return fn();
    },
    executeWrite: (_label: string, fn: () => Promise<unknown>) => fn(),
  }),
  FirestoreCircuitExecutor: vi.fn(),
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: mocks.loggerWarn,
      error: mocks.loggerError,
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
    collection: (name: string) => {
      const store =
        name === "payment_unresolved_events"
          ? mocks.unresolvedRecords
          : mocks.repairRecords;
      return {
        doc: (id: string) => createDocRef(store, id),
        where: (_field: string, _operator: string, value: unknown) => ({
          get: async () => {
            const docs = Array.from(store.entries())
              .filter(([, record]) => record.status === value)
              .map(([id, record]) => ({
                id,
                ref: createDocRef(store, id).ref,
                data: () => clone(record),
              }));
            return { empty: docs.length === 0, size: docs.length, docs };
          },
          orderBy: () => ({
            limit: () => ({
              _type: "query" as const,
              _statusFilter: value,
              _store: store,
            }),
          }),
        }),
      };
    },
    runTransaction: mocks.runTransaction,
  }),
}));

import { PaymentConsistencyStore } from "../PaymentConsistencyStore";

describe("PaymentConsistencyStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.unresolvedRecords.clear();
    mocks.repairRecords.clear();
    mocks.failNextRead = false;

    mocks.runTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: (target: MockDocRef | { _store: Map<string, StoreRecord> }) => {
            if ("get" in target && typeof target.get === "function") {
              return target.get();
            }
            const queryTarget = target as {
              _store: Map<string, StoreRecord>;
              _statusFilter: unknown;
            };
            const store = queryTarget._store;
            const docs = Array.from(store.entries())
              .filter(
                ([, record]) => record.status === queryTarget._statusFilter,
              )
              .sort((a, b) => {
                const aTs = Number(a[1].updatedAtMs ?? 0);
                const bTs = Number(b[1].updatedAtMs ?? 0);
                return aTs - bTs;
              })
              .slice(0, 1)
              .map(([id, record]) => ({
                id,
                ref: createDocRef(store, id).ref,
                data: () => clone(record),
              }));
            return Promise.resolve({ empty: docs.length === 0, docs });
          },
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

  describe("recordUnresolvedEvent — idempotency invariant", () => {
    it("creates a new open record with occurrenceCount=1 on first sighting", async () => {
      const store = new PaymentConsistencyStore();

      await store.recordUnresolvedEvent({
        eventId: "evt_1",
        eventType: "checkout.session.completed",
        reason: "missing-user",
        livemode: true,
      });

      const record = mocks.unresolvedRecords.get("evt_1");
      expect(record).toMatchObject({
        status: "open",
        eventType: "checkout.session.completed",
        reason: "missing-user",
        occurrenceCount: 1,
        livemode: true,
      });
      expect(record?.firstSeenAtMs).toBeTypeOf("number");
    });

    it("increments occurrenceCount and preserves firstSeenAtMs across duplicates", async () => {
      const store = new PaymentConsistencyStore();

      await store.recordUnresolvedEvent({
        eventId: "evt_dup",
        eventType: "invoice.paid",
        reason: "missing-billing-profile",
        livemode: false,
      });
      const firstSeen = mocks.unresolvedRecords.get("evt_dup")?.firstSeenAtMs;

      // Wait at least 1ms so a re-record cannot accidentally collide on Date.now().
      await new Promise((resolve) => setTimeout(resolve, 2));

      await store.recordUnresolvedEvent({
        eventId: "evt_dup",
        eventType: "invoice.paid",
        reason: "missing-billing-profile",
        livemode: false,
      });

      const record = mocks.unresolvedRecords.get("evt_dup");
      expect(record?.occurrenceCount).toBe(2);
      // firstSeenAtMs is the load-bearing invariant: if it drifted, "oldest open
      // age" telemetry would silently reset every retry, hiding stuck events.
      expect(record?.firstSeenAtMs).toBe(firstSeen);
      expect(Number(record?.lastSeenAtMs)).toBeGreaterThanOrEqual(
        Number(firstSeen),
      );
    });
  });

  describe("getUnresolvedSummary", () => {
    it("returns zeroed shape when no open events exist", async () => {
      const store = new PaymentConsistencyStore();
      const summary = await store.getUnresolvedSummary();
      expect(summary).toEqual({ openCount: 0, oldestOpenAgeMs: null });
    });

    it("computes oldestOpenAgeMs from min firstSeenAtMs across open events", async () => {
      const now = Date.now();
      mocks.unresolvedRecords.set("evt_old", {
        status: "open",
        firstSeenAtMs: now - 60_000,
      });
      mocks.unresolvedRecords.set("evt_new", {
        status: "open",
        firstSeenAtMs: now - 5_000,
      });
      mocks.unresolvedRecords.set("evt_resolved", {
        status: "resolved",
        firstSeenAtMs: now - 600_000,
      });

      const summary =
        await new PaymentConsistencyStore().getUnresolvedSummary();
      expect(summary.openCount).toBe(2);
      expect(summary.oldestOpenAgeMs).toBeGreaterThanOrEqual(60_000);
      expect(summary.oldestOpenAgeMs).toBeLessThan(120_000);
    });

    it("fails open (returns zero shape, logs warning) when the read errors", async () => {
      mocks.failNextRead = true;
      const summary =
        await new PaymentConsistencyStore().getUnresolvedSummary();
      // Telemetry must never throw and crash the request path.
      expect(summary).toEqual({ openCount: 0, oldestOpenAgeMs: null });
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });
  });

  describe("enqueueBillingProfileRepair", () => {
    it("creates a pending repair with attempts=0 on first enqueue", async () => {
      await new PaymentConsistencyStore().enqueueBillingProfileRepair({
        repairKey: "user_123:cus_abc",
        source: "checkout",
        userId: "user_123",
        stripeCustomerId: "cus_abc",
        stripeLivemode: true,
        referenceId: "ref_1",
      });

      const record = mocks.repairRecords.get("user_123:cus_abc");
      expect(record).toMatchObject({
        status: "pending",
        attempts: 0,
        userId: "user_123",
        stripeCustomerId: "cus_abc",
      });
    });

    it("does NOT overwrite a resolved repair (idempotency invariant)", async () => {
      mocks.repairRecords.set("repair_done", {
        status: "resolved",
        userId: "user_999",
        attempts: 2,
        resolvedAtMs: 1_000,
      });

      await new PaymentConsistencyStore().enqueueBillingProfileRepair({
        repairKey: "repair_done",
        source: "invoice",
        userId: "user_999",
        stripeCustomerId: "cus_done",
        stripeLivemode: true,
        referenceId: "ref_2",
      });

      // Resolved must remain resolved — re-opening would replay billing repair work
      // we already finished and could double-issue credits.
      const record = mocks.repairRecords.get("repair_done");
      expect(record?.status).toBe("resolved");
      expect(record?.attempts).toBe(2);
    });

    it("clears stale lastError and processingStartedAtMs when re-enqueuing a non-resolved repair", async () => {
      mocks.repairRecords.set("repair_stale", {
        status: "pending",
        attempts: 1,
        lastError: "previous failure",
        processingStartedAtMs: 5_000,
        userId: "user_5",
      });

      await new PaymentConsistencyStore().enqueueBillingProfileRepair({
        repairKey: "repair_stale",
        source: "checkout",
        userId: "user_5",
        stripeCustomerId: "cus_5",
        stripeLivemode: false,
        referenceId: "ref_3",
      });

      const record = mocks.repairRecords.get("repair_stale");
      expect(record?.lastError).toBeUndefined();
      expect(record?.processingStartedAtMs).toBeUndefined();
    });
  });

  describe("claimNextBillingProfileRepair", () => {
    it("returns null when no pending repairs exist", async () => {
      const task =
        await new PaymentConsistencyStore().claimNextBillingProfileRepair(3);
      expect(task).toBeNull();
    });

    it("transitions pending → processing and returns a task with the existing attempt count", async () => {
      mocks.repairRecords.set("repair_a", {
        status: "pending",
        attempts: 0,
        source: "checkout",
        userId: "u",
        stripeCustomerId: "cus",
        stripeLivemode: true,
        referenceId: "ref",
        updatedAtMs: 100,
      });

      const task =
        await new PaymentConsistencyStore().claimNextBillingProfileRepair(3);

      expect(task).not.toBeNull();
      expect(task?.repairKey).toBe("repair_a");
      expect(task?.attempts).toBe(0);
      expect(mocks.repairRecords.get("repair_a")?.status).toBe("processing");
    });

    it("escalates a record that has reached maxAttempts instead of returning it", async () => {
      mocks.repairRecords.set("repair_burnt", {
        status: "pending",
        attempts: 3,
        source: "invoice",
        userId: "u",
        stripeCustomerId: "cus",
        stripeLivemode: true,
        referenceId: "ref",
        updatedAtMs: 100,
      });

      const task =
        await new PaymentConsistencyStore().claimNextBillingProfileRepair(3);

      // Returning a maxed-out task would trigger an infinite retry loop;
      // escalation is the kill switch.
      expect(task).toBeNull();
      expect(mocks.repairRecords.get("repair_burnt")?.status).toBe("escalated");
    });
  });

  describe("releaseBillingProfileRepairForRetry", () => {
    it("increments attempts, resets to pending, and records lastError", async () => {
      mocks.repairRecords.set("repair_retry", {
        status: "processing",
        attempts: 1,
        userId: "u",
        stripeCustomerId: "cus",
        stripeLivemode: true,
        source: "checkout",
        referenceId: "ref",
        updatedAtMs: 100,
      });

      await new PaymentConsistencyStore().releaseBillingProfileRepairForRetry(
        "repair_retry",
        "stripe-429",
      );

      const record = mocks.repairRecords.get("repair_retry");
      expect(record?.status).toBe("pending");
      expect(record?.attempts).toBe(2);
      expect(record?.lastError).toBe("stripe-429");
    });

    it("is a no-op when the document does not exist", async () => {
      await expect(
        new PaymentConsistencyStore().releaseBillingProfileRepairForRetry(
          "missing",
          "irrelevant",
        ),
      ).resolves.toBeUndefined();
      expect(mocks.repairRecords.has("missing")).toBe(false);
    });
  });

  describe("markBillingProfileRepairResolved", () => {
    it("merges resolved status onto the existing record", async () => {
      mocks.repairRecords.set("repair_to_resolve", {
        status: "processing",
        attempts: 1,
        userId: "u",
      });

      await new PaymentConsistencyStore().markBillingProfileRepairResolved(
        "repair_to_resolve",
      );

      const record = mocks.repairRecords.get("repair_to_resolve");
      expect(record?.status).toBe("resolved");
      expect(record?.resolvedAtMs).toBeTypeOf("number");
      // merge: prior fields survive
      expect(record?.userId).toBe("u");
    });
  });
});
