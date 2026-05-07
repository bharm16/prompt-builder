import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoJobError, VideoJobRecord } from "../types";

/**
 * Forward-compatibility regression tests for DlqEntry.
 *
 * Invariants:
 *   1. New writes via DeadLetterStore.enqueueDeadLetter include `schemaVersion: 1`.
 *   2. Reading a legacy DLQ record (no `schemaVersion`) parses without error.
 *   3. Reading a record with `schemaVersion: 1` parses without error.
 *   4. Reading a record with `schemaVersion: 2` (future) throws a Zod error
 *      so old pods fail loudly rather than silently mis-parsing newer shapes.
 */

type StoreRecord = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  records: new Map<string, StoreRecord>(),
  setCalls: [] as Array<{
    id: string;
    data: StoreRecord;
    options: { merge?: boolean } | undefined;
  }>,
  serverTimestamp: vi.fn(() => ({ _methodName: "FieldValue.serverTimestamp" })),
  fieldDelete: vi.fn(() => ({ _methodName: "FieldValue.delete" })),
}));

const createDocRef = (id: string) => ({
  id,
  set: async (data: StoreRecord, options?: { merge?: boolean }) => {
    mocks.setCalls.push({ id, data, options });
    mocks.records.set(id, { ...data });
  },
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
      doc: (id: string) => createDocRef(id),
      where: () => ({}),
    }),
    runTransaction: async () => null,
  }),
}));

import { DeadLetterStore, parseDlqEntry } from "../DeadLetterStore";

const passThroughExecutor = {
  executeRead: async <T>(_name: string, fn: () => Promise<T>) => fn(),
  executeWrite: async <T>(_name: string, fn: () => Promise<T>) => fn(),
};

const sampleJob: VideoJobRecord = {
  id: "job-abc",
  status: "failed",
  userId: "user-1",
  request: { prompt: "p", options: {} },
  creditsReserved: 7,
  provider: "kling",
  attempts: 3,
  maxAttempts: 3,
  createdAtMs: 100,
  updatedAtMs: 200,
};

const sampleError: VideoJobError = {
  message: "boom",
  category: "provider",
  retryable: true,
};

describe("DlqEntry schemaVersion forward-compat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.records.clear();
    mocks.setCalls.length = 0;
  });

  it("enqueueDeadLetter writes schemaVersion: 1 onto the new record", async () => {
    const store = new DeadLetterStore(
      // The mock doesn't enforce circuit-executor types — pass-through is enough.
      passThroughExecutor as never,
    );

    await store.enqueueDeadLetter(sampleJob, sampleError, "worker-terminal");

    expect(mocks.setCalls).toHaveLength(1);
    expect(mocks.setCalls[0]?.data).toMatchObject({
      schemaVersion: 1,
      jobId: "job-abc",
    });
  });

  it("parses legacy DLQ records (no schemaVersion) without throwing", () => {
    const legacy: Record<string, unknown> = {
      jobId: "job-legacy",
      userId: "user-legacy",
      request: { prompt: "x", options: {} },
      creditsReserved: 0,
      creditsRefunded: false,
      provider: "kling",
      error: { message: "old" },
      source: "worker-terminal",
      dlqAttempt: 0,
      maxDlqAttempts: 3,
    };

    const entry = parseDlqEntry("dlq-legacy", legacy);

    expect(entry.id).toBe("dlq-legacy");
    expect(entry.jobId).toBe("job-legacy");
    expect(entry.schemaVersion).toBeUndefined();
  });

  it("parses DLQ records with schemaVersion: 1 and preserves the value", () => {
    const v1: Record<string, unknown> = {
      schemaVersion: 1,
      jobId: "job-v1",
      userId: "user-v1",
      request: { prompt: "x", options: {} },
      creditsReserved: 1,
      creditsRefunded: true,
      provider: "kling",
      error: { message: "v1" },
      source: "worker-terminal",
      dlqAttempt: 0,
      maxDlqAttempts: 3,
    };

    const entry = parseDlqEntry("dlq-v1", v1);

    expect(entry.schemaVersion).toBe(1);
    expect(entry.creditsRefunded).toBe(true);
  });

  it("rejects DLQ records with schemaVersion: 2 (future) so older pods fail loudly", () => {
    const future: Record<string, unknown> = {
      schemaVersion: 2,
      jobId: "job-future",
      userId: "user-future",
      request: { prompt: "x", options: {} },
      creditsReserved: 0,
      creditsRefunded: false,
      provider: "kling",
      error: { message: "future" },
      source: "worker-terminal",
      dlqAttempt: 0,
      maxDlqAttempts: 3,
    };

    expect(() => parseDlqEntry("dlq-future", future)).toThrow();
  });
});
