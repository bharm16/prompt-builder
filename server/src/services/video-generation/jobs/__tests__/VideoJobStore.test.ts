import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoJobRecord } from "../types";

type StoreRecord = Record<string, unknown>;

type QueryFilter = {
  field: string;
  operator: "==" | "<=";
  value: unknown;
};

const getPathValue = (record: StoreRecord, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, segment) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, record);

const matchesFilter = (record: StoreRecord, filter: QueryFilter): boolean => {
  const value = getPathValue(record, filter.field);
  if (filter.operator === "==") {
    return value === filter.value;
  }
  if (typeof value !== "number" || typeof filter.value !== "number") {
    return false;
  }
  return value <= filter.value;
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

type MockQuery = {
  __isQuery: true;
  where: (field: string, operator: "==" | "<=", value: unknown) => MockQuery;
  orderBy: (field: string, direction?: "asc" | "desc") => MockQuery;
  limit: (count: number) => MockQuery;
  get: () => Promise<{
    empty: boolean;
    docs: Array<{ id: string; ref: MockDocRef; data: () => StoreRecord }>;
  }>;
};

const mocks = vi.hoisted(() => ({
  records: new Map<string, StoreRecord>(),
  idCounter: 0,
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerDebug: vi.fn(),
  runTransactionError: null as Error | null,
  serverTimestamp: vi.fn(() => ({ _methodName: "FieldValue.serverTimestamp" })),
  fieldDelete: vi.fn(() => ({ _methodName: "FieldValue.delete" })),
}));

const createDocRef = (id: string): MockDocRef => {
  const ref = {
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

const createQuery = (
  filters: QueryFilter[] = [],
  orderField?: string,
  orderDirection: "asc" | "desc" = "asc",
  limitCount?: number,
): MockQuery => ({
  __isQuery: true,
  where: (field: string, operator: "==" | "<=", value: unknown) =>
    createQuery(
      [...filters, { field, operator, value }],
      orderField,
      orderDirection,
      limitCount,
    ),
  orderBy: (field: string, direction: "asc" | "desc" = "asc") =>
    createQuery(filters, field, direction, limitCount),
  limit: (count: number) =>
    createQuery(filters, orderField, orderDirection, count),
  get: async () => {
    const entries = Array.from(mocks.records.entries())
      .filter(([, record]) =>
        filters.every((filter) => matchesFilter(record, filter)),
      )
      .sort((a, b) => {
        if (!orderField) return 0;
        const aValue = getPathValue(a[1], orderField);
        const bValue = getPathValue(b[1], orderField);
        const av =
          typeof aValue === "number" ? aValue : Number.MAX_SAFE_INTEGER;
        const bv =
          typeof bValue === "number" ? bValue : Number.MAX_SAFE_INTEGER;
        return orderDirection === "asc" ? av - bv : bv - av;
      });
    const sliced = limitCount ? entries.slice(0, limitCount) : entries;
    const docs = sliced.map(([id, record]) => ({
      id,
      ref: createDocRef(id),
      data: () => ({ ...record }),
    }));
    return {
      empty: docs.length === 0,
      docs,
    };
  },
});

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

vi.mock("@services/video-models/ModelRegistry", () => ({
  resolveGenerationModelSelection: vi.fn(() => ({
    modelId: "wan-video/wan-2.2-t2v-fast",
    source: "default",
  })),
  resolveGenerationModelId: vi.fn((input: string) => input),
  isKnownGenerationModelInput: vi.fn(() => true),
  isOpenAISoraModelId: vi.fn((id: string) => id.includes("sora")),
  isLumaModelId: vi.fn((id: string) => id.includes("luma")),
  isKlingModelId: vi.fn((id: string) => id.includes("kling")),
  isVeoModelId: vi.fn((id: string) => id.includes("veo")),
  resolveProviderForGenerationModel: vi.fn((modelId: string) => {
    if (modelId.includes("sora")) return "openai";
    if (modelId.includes("kling")) return "kling";
    if (modelId.includes("veo")) return "gemini";
    if (modelId.includes("luma")) return "luma";
    return "replicate";
  }),
  resolvePromptModelId: vi.fn(() => null),
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    error: mocks.loggerError,
    child: () => ({
      warn: mocks.loggerWarn,
      debug: mocks.loggerDebug,
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
      where: (field: string, operator: "==" | "<=", value: unknown) =>
        createQuery([{ field, operator, value }]),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (mocks.runTransactionError) {
        throw mocks.runTransactionError;
      }
      const tx = {
        get: async (target: MockDocRef | MockQuery) => {
          if ((target as MockQuery).__isQuery) {
            return (target as MockQuery).get();
          }
          return (target as MockDocRef).get();
        },
        update: async (docRef: MockDocRef, data: StoreRecord) =>
          docRef.update(data),
        set: async (
          docRef: MockDocRef,
          data: StoreRecord,
          options?: { merge?: boolean },
        ) => docRef.set(data, options),
      };
      return fn(tx);
    },
  }),
}));

import { VideoJobStore } from "../VideoJobStore";

describe("VideoJobStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T00:00:00.000Z"));
    mocks.records.clear();
    mocks.idCounter = 0;
    mocks.runTransactionError = null;
  });

  it("createJob stores queued state", async () => {
    const store = new VideoJobStore();

    const job = await store.createJob({
      userId: "user-1",
      request: {
        prompt: "a prompt",
        options: {
          model: "sora-2",
        },
      },
      creditsReserved: 12,
    });

    expect(job.id).toBe("job-1");
    expect(job.status).toBe("queued");
    expect(job.userId).toBe("user-1");
    expect(job.request.options).toEqual({ model: "sora-2" });
    expect(job.creditsReserved).toBe(12);
    expect(mocks.records.get("job-1")).toMatchObject({
      status: "queued",
      userId: "user-1",
      creditsReserved: 12,
    });
  });

  it("preserves extended generation option fields through schema parsing", async () => {
    const store = new VideoJobStore();

    const job = await store.createJob({
      userId: "user-extended",
      request: {
        prompt: "extended prompt",
        options: {
          model: "google/veo-3",
          seed: 456,
          seconds: "6",
          endImage: "https://images.example.com/end.png",
          referenceImages: [
            { url: "https://images.example.com/ref.png", type: "asset" },
          ],
          extendVideoUrl: "https://videos.example.com/source.mp4",
        },
      },
      creditsReserved: 18,
    });

    expect(job.request.options).toEqual({
      model: "google/veo-3",
      seed: 456,
      seconds: "6",
      endImage: "https://images.example.com/end.png",
      referenceImages: [
        { url: "https://images.example.com/ref.png", type: "asset" },
      ],
      extendVideoUrl: "https://videos.example.com/source.mp4",
    });
  });

  it("getJob and findJobByAssetId return parsed records and null when missing", async () => {
    mocks.records.set("job-a", {
      status: "completed",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 3,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      result: {
        assetId: "asset-77",
        videoUrl: "https://example.com/video.mp4",
        contentType: "video/mp4",
      },
    });
    const store = new VideoJobStore();

    const byId = await store.getJob("job-a");
    const byAsset = await store.findJobByAssetId("asset-77");
    const missing = await store.getJob("missing");

    expect(byId?.id).toBe("job-a");
    expect(byAsset?.id).toBe("job-a");
    expect(missing).toBeNull();
  });

  it("claimJob transitions queued jobs to processing and rejects non-queued jobs", async () => {
    mocks.records.set("job-queued", {
      status: "queued",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 4,
      createdAtMs: Date.now() - 1_000,
      updatedAtMs: Date.now() - 1_000,
    });
    const store = new VideoJobStore();

    const claimed = await store.claimJob("job-queued", "worker-1", 5_000);
    const secondClaim = await store.claimJob("job-queued", "worker-2", 5_000);

    expect(claimed?.status).toBe("processing");
    expect(claimed?.workerId).toBe("worker-1");
    expect(typeof claimed?.leaseExpiresAtMs).toBe("number");
    expect(secondClaim).toBeNull();
  });

  it("claimNextJob prioritizes queued jobs then falls back to expired processing leases", async () => {
    mocks.records.set("job-queued", {
      status: "queued",
      userId: "user-1",
      request: { prompt: "queued", options: { model: "sora-2" } },
      creditsReserved: 2,
      createdAtMs: Date.now() - 2_000,
      updatedAtMs: Date.now() - 2_000,
    });
    mocks.records.set("job-expired", {
      status: "processing",
      userId: "user-2",
      request: { prompt: "expired", options: { model: "sora-2" } },
      creditsReserved: 2,
      createdAtMs: Date.now() - 5_000,
      updatedAtMs: Date.now() - 5_000,
      leaseExpiresAtMs: Date.now() - 100,
      workerId: "old-worker",
    });
    const store = new VideoJobStore();

    const first = await store.claimNextJob("worker-new", 3_000);
    const second = await store.claimNextJob("worker-new", 3_000);

    expect(first?.id).toBe("job-queued");
    expect(second?.id).toBe("job-expired");
    expect(second?.status).toBe("processing");
    expect(second?.workerId).toBe("worker-new");
  });

  it("markCompleted updates processing jobs and clears lease metadata", async () => {
    mocks.records.set("job-processing", {
      status: "processing",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 4,
      createdAtMs: Date.now() - 3_000,
      updatedAtMs: Date.now() - 2_000,
      workerId: "worker-1",
      leaseExpiresAtMs: Date.now() + 10_000,
    });
    const store = new VideoJobStore();

    const updated = await store.markCompleted("job-processing", {
      assetId: "asset-9",
      videoUrl: "https://example.com/output.mp4",
      contentType: "video/mp4",
      storagePath: "users/user-1/video.mp4",
    });
    const record = mocks.records.get("job-processing");

    expect(updated).toBe(true);
    expect(record?.status).toBe("completed");
    expect(record?.result).toMatchObject({
      assetId: "asset-9",
      storagePath: "users/user-1/video.mp4",
    });
    expect(record).not.toHaveProperty("workerId");
    expect(record).not.toHaveProperty("leaseExpiresAtMs");
  });

  it("claimNextJob skips a queued job whose nextRetryAtMs is in the future (backoff)", async () => {
    const now = Date.now();
    mocks.records.set("job-waiting", {
      status: "queued",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 2,
      createdAtMs: now - 5_000,
      updatedAtMs: now - 5_000,
      nextRetryAtMs: now + 60_000, // 60s in the future
    });
    const store = new VideoJobStore();

    const claimed = await store.claimNextJob("worker-1", 3_000);

    expect(claimed).toBeNull();
    expect(mocks.records.get("job-waiting")?.status).toBe("queued");
  });

  it("claimNextJob claims a queued job whose nextRetryAtMs has elapsed", async () => {
    const now = Date.now();
    mocks.records.set("job-ready", {
      status: "queued",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 2,
      createdAtMs: now - 120_000,
      updatedAtMs: now - 120_000,
      nextRetryAtMs: now - 5_000, // 5s in the past
    });
    const store = new VideoJobStore();

    const claimed = await store.claimNextJob("worker-1", 3_000);

    expect(claimed?.id).toBe("job-ready");
    expect(claimed?.status).toBe("processing");
    // nextRetryAtMs should be cleared when the job is claimed
    expect(mocks.records.get("job-ready")).not.toHaveProperty("nextRetryAtMs");
  });

  it("markFailed sets failure state but does not override completed jobs", async () => {
    mocks.records.set("job-processing", {
      status: "processing",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 4,
      createdAtMs: Date.now() - 3_000,
      updatedAtMs: Date.now() - 2_000,
      workerId: "worker-1",
      leaseExpiresAtMs: Date.now() + 10_000,
    });
    mocks.records.set("job-completed", {
      status: "completed",
      userId: "user-2",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 4,
      createdAtMs: Date.now() - 3_000,
      updatedAtMs: Date.now() - 2_000,
    });
    const store = new VideoJobStore();

    const failed = await store.markFailed("job-processing", "provider timeout");
    const unchanged = await store.markFailed("job-completed", "ignored");

    expect(failed).toBe(true);
    expect(unchanged).toBe(false);
    expect(mocks.records.get("job-processing")).toMatchObject({
      status: "failed",
      error: { message: "provider timeout" },
    });
    expect(mocks.records.get("job-processing")).not.toHaveProperty("workerId");
    expect(mocks.records.get("job-processing")).not.toHaveProperty(
      "leaseExpiresAtMs",
    );
  });

  it("fails stale queued and processing jobs using cutoff queries", async () => {
    const now = Date.now();
    mocks.records.set("job-stale-queued", {
      status: "queued",
      userId: "user-1",
      request: { prompt: "queued", options: { model: "sora-2" } },
      creditsReserved: 1,
      createdAtMs: now - 10_000,
      updatedAtMs: now - 10_000,
    });
    mocks.records.set("job-stale-processing", {
      status: "processing",
      userId: "user-1",
      request: { prompt: "processing", options: { model: "sora-2" } },
      creditsReserved: 1,
      createdAtMs: now - 10_000,
      updatedAtMs: now - 10_000,
      leaseExpiresAtMs: now - 1_000,
    });
    const store = new VideoJobStore();

    const failedQueued = await store.failNextQueuedStaleJob(
      now - 5_000,
      "queued too long",
    );
    const failedProcessing = await store.failNextProcessingStaleJob(
      now - 500,
      "processing stalled",
    );

    expect(failedQueued?.status).toBe("failed");
    expect(failedQueued?.error?.message).toBe("queued too long");
    expect(failedProcessing?.status).toBe("failed");
    expect(failedProcessing?.error?.message).toBe("processing stalled");
  });

  it("renews leases and releases claims with explicit reason", async () => {
    mocks.records.set("job-processing", {
      status: "processing",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 4,
      attempts: 1,
      maxAttempts: 3,
      createdAtMs: Date.now() - 3_000,
      updatedAtMs: Date.now() - 2_000,
      workerId: "worker-1",
      leaseExpiresAtMs: Date.now() + 10_000,
      lastHeartbeatAtMs: Date.now() - 1_000,
    });
    const store = new VideoJobStore();

    const renewed = await store.renewLease(
      "job-processing",
      "worker-1",
      15_000,
    );
    const released = await store.releaseClaim(
      "job-processing",
      "worker-1",
      "worker shutdown",
    );
    const record = mocks.records.get("job-processing");

    expect(renewed).toBe(true);
    expect(released).toBe(true);
    expect(record?.status).toBe("queued");
    expect(record).not.toHaveProperty("workerId");
    expect(record).not.toHaveProperty("leaseExpiresAtMs");
    expect(record).toMatchObject({
      releaseReason: "worker shutdown",
    });
  });

  it("requeues retryable errors and can enqueue dead-letter records", async () => {
    mocks.records.set("job-processing", {
      status: "processing",
      userId: "user-1",
      request: { prompt: "prompt", options: { model: "sora-2" } },
      creditsReserved: 4,
      attempts: 2,
      maxAttempts: 3,
      createdAtMs: Date.now() - 3_000,
      updatedAtMs: Date.now() - 2_000,
      workerId: "worker-1",
      leaseExpiresAtMs: Date.now() + 10_000,
    });
    const store = new VideoJobStore();

    const requeued = await store.requeueForRetry("job-processing", "worker-1", {
      message: "provider timeout",
      code: "VIDEO_JOB_TIMEOUT",
      category: "timeout",
      retryable: true,
      stage: "generation",
      attempt: 2,
    });
    const job = await store.getJob("job-processing");

    expect(requeued).toBe(true);
    expect(job?.status).toBe("queued");
    expect(job?.error).toMatchObject({
      code: "VIDEO_JOB_TIMEOUT",
      category: "timeout",
      retryable: true,
    });
    expect(typeof job?.nextRetryAtMs).toBe("number");
    expect((job?.nextRetryAtMs ?? 0) > Date.now()).toBe(true);

    await expect(
      store.enqueueDeadLetter(
        {
          ...(job as VideoJobRecord),
          id: "job-processing",
          status: "failed",
        },
        {
          message: "provider timeout",
          code: "VIDEO_JOB_TIMEOUT",
          category: "timeout",
          retryable: false,
          stage: "generation",
          attempt: 3,
        },
        "worker-terminal",
      ),
    ).resolves.toBeUndefined();
  });

  it("returns safe values and logs when transactions fail", async () => {
    const store = new VideoJobStore();
    mocks.runTransactionError = new Error("firestore offline");

    await expect(
      store.claimJob("missing", "worker-1", 5_000),
    ).resolves.toBeNull();
    await expect(
      store.markCompleted("missing", {
        assetId: "asset-1",
        videoUrl: "https://example.com/video.mp4",
        contentType: "video/mp4",
      }),
    ).resolves.toBe(false);
    await expect(store.markFailed("missing", "error")).resolves.toBe(false);
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  describe("createJobWithReservation (atomic credit reserve + job create)", () => {
    it("reserves credits AND creates job in a single transaction on success", async () => {
      const store = new VideoJobStore();
      const creditCalls: Array<{ userId: string; cost: number }> = [];
      const creditService = {
        checkAndReserveInTransaction: vi
          .fn()
          .mockImplementation(
            async (
              _tx: unknown,
              userId: string,
              cost: number,
            ): Promise<{ ok: true }> => {
              creditCalls.push({ userId, cost });
              return { ok: true };
            },
          ),
      };

      const result = await store.createJobWithReservation(
        {
          userId: "user-1",
          request: { prompt: "p", options: { model: "sora-2" } },
          creditsReserved: 10,
        },
        { creditService, cost: 10 },
      );

      expect(result.reserved).toBe(true);
      if (!result.reserved) return;
      expect(result.job.id).toBe("job-1");
      expect(result.job.status).toBe("queued");
      expect(creditCalls).toEqual([{ userId: "user-1", cost: 10 }]);
      expect(mocks.records.get("job-1")).toMatchObject({
        status: "queued",
        userId: "user-1",
        creditsReserved: 10,
      });
    });

    it("returns insufficient_credits and does NOT create the job", async () => {
      const store = new VideoJobStore();
      const creditService = {
        checkAndReserveInTransaction: vi.fn().mockResolvedValue({
          ok: false,
          reason: "insufficient_credits",
        }),
      };

      const result = await store.createJobWithReservation(
        {
          userId: "user-broke",
          request: { prompt: "p", options: { model: "sora-2" } },
          creditsReserved: 10,
        },
        { creditService, cost: 10 },
      );

      expect(result.reserved).toBe(false);
      if (result.reserved) return;
      expect(result.reason).toBe("insufficient_credits");
      expect(mocks.records.size).toBe(0);
    });

    it("returns user_not_found and does NOT create the job", async () => {
      const store = new VideoJobStore();
      const creditService = {
        checkAndReserveInTransaction: vi
          .fn()
          .mockResolvedValue({ ok: false, reason: "user_not_found" }),
      };

      const result = await store.createJobWithReservation(
        {
          userId: "ghost",
          request: { prompt: "p", options: { model: "sora-2" } },
          creditsReserved: 5,
        },
        { creditService, cost: 5 },
      );

      expect(result.reserved).toBe(false);
      if (result.reserved) return;
      expect(result.reason).toBe("user_not_found");
      expect(mocks.records.size).toBe(0);
    });

    it("propagates errors from the atomic transaction without creating partial state", async () => {
      const store = new VideoJobStore();
      mocks.runTransactionError = new Error("Firestore unavailable");
      const creditService = {
        checkAndReserveInTransaction: vi.fn().mockResolvedValue({ ok: true }),
      };

      await expect(
        store.createJobWithReservation(
          {
            userId: "user-1",
            request: { prompt: "p", options: { model: "sora-2" } },
            creditsReserved: 10,
          },
          { creditService, cost: 10 },
        ),
      ).rejects.toThrow("Firestore unavailable");
      expect(mocks.records.size).toBe(0);
    });

    it("persists sessionId when provided and parses it back on read", async () => {
      const store = new VideoJobStore();
      const creditService = {
        checkAndReserveInTransaction: vi.fn().mockResolvedValue({ ok: true }),
      };

      const result = await store.createJobWithReservation(
        {
          userId: "user-1",
          sessionId: "session-42",
          request: { prompt: "p", options: { model: "sora-2" } },
          creditsReserved: 5,
        },
        { creditService, cost: 5 },
      );

      expect(result.reserved).toBe(true);
      if (!result.reserved) return;
      expect(result.job.sessionId).toBe("session-42");
      expect(mocks.records.get("job-1")).toMatchObject({
        sessionId: "session-42",
      });
    });
  });

  describe("session cascade", () => {
    it("findJobsBySessionId returns only jobs with the matching sessionId", async () => {
      mocks.records.set("job-a", {
        status: "queued",
        userId: "user-1",
        sessionId: "session-1",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      mocks.records.set("job-b", {
        status: "processing",
        userId: "user-1",
        sessionId: "session-1",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      mocks.records.set("job-c", {
        status: "queued",
        userId: "user-1",
        sessionId: "different-session",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      mocks.records.set("job-d", {
        status: "queued",
        userId: "user-1",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      const store = new VideoJobStore();

      const jobs = await store.findJobsBySessionId("session-1");

      expect(jobs.map((j) => j.id).sort()).toEqual(["job-a", "job-b"]);
    });

    it("cancelJobsForSession marks queued/processing jobs as failed and leaves terminal jobs alone", async () => {
      mocks.records.set("job-q", {
        status: "queued",
        userId: "user-1",
        sessionId: "session-cancel",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      mocks.records.set("job-p", {
        status: "processing",
        userId: "user-1",
        sessionId: "session-cancel",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        workerId: "worker-1",
        leaseExpiresAtMs: Date.now() + 60_000,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      mocks.records.set("job-done", {
        status: "completed",
        userId: "user-1",
        sessionId: "session-cancel",
        request: { prompt: "p", options: { model: "sora-2" } },
        creditsReserved: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        result: {
          assetId: "asset-1",
          videoUrl: "https://example.com/v.mp4",
          contentType: "video/mp4",
        },
      });
      const store = new VideoJobStore();

      const cancelled = await store.cancelJobsForSession("session-cancel");

      expect(cancelled).toBe(2);
      expect(mocks.records.get("job-q")?.status).toBe("failed");
      expect(mocks.records.get("job-p")?.status).toBe("failed");
      expect(mocks.records.get("job-done")?.status).toBe("completed");
      expect(
        (mocks.records.get("job-q") as { error?: { code?: string } })?.error
          ?.code,
      ).toBe("SESSION_DELETED");
    });
  });
});
