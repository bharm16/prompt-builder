import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Forward-compatibility regression tests for VideoJobRecord.
 *
 * Invariants:
 *   1. New writes via VideoJobStore.createJob include `schemaVersion: 1`.
 *   2. Reading a legacy record (no `schemaVersion`) parses without error.
 *   3. Reading a record with `schemaVersion: 1` parses without error.
 *   4. Reading a record with `schemaVersion: 2` (future) throws a Zod error
 *      so old pods fail loudly rather than silently mis-parsing newer shapes.
 */

type StoreRecord = Record<string, unknown>;

type MockDocRef = {
  id: string;
  ref: MockDocRef;
  get: () => Promise<{
    exists: boolean;
    id: string;
    data: () => StoreRecord | undefined;
  }>;
  set: (data: StoreRecord, options?: { merge?: boolean }) => Promise<void>;
  update: (data: StoreRecord) => Promise<void>;
};

const applyPatch = (current: StoreRecord, patch: StoreRecord): StoreRecord => {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (
      (value as { _methodName?: string } | undefined)?._methodName ===
      "FieldValue.delete"
    ) {
      delete next[key];
      continue;
    }
    if (
      (value as { _methodName?: string } | undefined)?._methodName ===
      "FieldValue.serverTimestamp"
    ) {
      next[key] = Date.now();
      continue;
    }
    next[key] = value;
  }
  return next;
};

const mocks = vi.hoisted(() => ({
  records: new Map<string, StoreRecord>(),
  idCounter: 0,
  serverTimestamp: vi.fn(() => ({ _methodName: "FieldValue.serverTimestamp" })),
  fieldDelete: vi.fn(() => ({ _methodName: "FieldValue.delete" })),
}));

const createDocRef = (id: string): MockDocRef => {
  const ref: MockDocRef = {
    id,
    ref: undefined as unknown as MockDocRef,
    get: async () => {
      const record = mocks.records.get(id);
      return {
        exists: Boolean(record),
        id,
        data: () => (record ? { ...record } : undefined),
      };
    },
    set: async (data: StoreRecord, options?: { merge?: boolean }) => {
      const current = mocks.records.get(id);
      if (options?.merge && current) {
        mocks.records.set(id, applyPatch(current, data));
        return;
      }
      mocks.records.set(id, applyPatch({}, data));
    },
    update: async (data: StoreRecord) => {
      const current = mocks.records.get(id);
      if (!current) {
        throw new Error(`Document not found: ${id}`);
      }
      mocks.records.set(id, applyPatch(current, data));
    },
  };
  ref.ref = ref;
  return ref;
};

vi.mock("@services/firestore/FirestoreCircuitExecutor", () => {
  const passThrough = {
    executeRead: async (_name: string, fn: () => Promise<unknown>) => fn(),
    executeWrite: async (_name: string, fn: () => Promise<unknown>) => fn(),
  };
  return {
    FirestoreCircuitExecutor: vi.fn(() => passThrough),
    getFirestoreCircuitExecutor: vi.fn(() => passThrough),
  };
});

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    error: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
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
      doc: (id?: string) => {
        const resolvedId = id ?? `job-${++mocks.idCounter}`;
        return createDocRef(resolvedId);
      },
      where: () => ({}),
    }),
    runTransaction: async () => null,
  }),
}));

import { VideoJobStore } from "../VideoJobStore";
import { parseVideoJobRecord } from "../parseVideoJobRecord";

describe("VideoJobRecord schemaVersion forward-compat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records.clear();
    mocks.idCounter = 0;
  });

  it("createJob writes schemaVersion: 1 onto the new record", async () => {
    const store = new VideoJobStore();

    const job = await store.createJob({
      userId: "user-1",
      request: {
        prompt: "a prompt",
        options: { model: "sora-2" },
      },
      creditsReserved: 5,
    });

    expect(job.schemaVersion).toBe(1);
    expect(mocks.records.get("job-1")).toMatchObject({
      schemaVersion: 1,
      status: "queued",
    });
  });

  it("parses legacy records (no schemaVersion) without throwing", () => {
    const legacy = {
      // schemaVersion intentionally omitted to simulate pre-migration data
      status: "queued",
      userId: "user-legacy",
      request: { prompt: "legacy", options: {} },
      creditsReserved: 0,
      attempts: 0,
      maxAttempts: 3,
      createdAtMs: 1,
      updatedAtMs: 1,
    };

    const parsed = parseVideoJobRecord("legacy-1", legacy, 3);

    expect(parsed.id).toBe("legacy-1");
    expect(parsed.status).toBe("queued");
    expect(parsed.schemaVersion).toBeUndefined();
  });

  it("parses records with schemaVersion: 1 and preserves the value", () => {
    const v1 = {
      schemaVersion: 1,
      status: "queued",
      userId: "user-v1",
      request: { prompt: "v1", options: {} },
      creditsReserved: 0,
      attempts: 0,
      maxAttempts: 3,
      createdAtMs: 1,
      updatedAtMs: 1,
    };

    const parsed = parseVideoJobRecord("v1-1", v1, 3);

    expect(parsed.schemaVersion).toBe(1);
  });

  it("rejects records with schemaVersion: 2 (future) so older pods fail loudly", () => {
    const future = {
      schemaVersion: 2,
      status: "queued",
      userId: "user-future",
      request: { prompt: "future", options: {} },
      creditsReserved: 0,
      attempts: 0,
      maxAttempts: 3,
      createdAtMs: 1,
      updatedAtMs: 1,
    };

    expect(() => parseVideoJobRecord("future-1", future, 3)).toThrow();
  });
});
