import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';

type StoreRecord = Record<string, unknown>;

type MockDocRef = {
  id: string;
  get: () => Promise<{ exists: boolean; data: () => StoreRecord | undefined }>;
  set: (data: StoreRecord, options?: { merge?: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  records: new Map<string, StoreRecord>(),
  malformedDocIds: new Set<string>(),
  failSetDocIds: new Set<string>(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  fieldDelete: vi.fn(() => ({ _methodName: 'FieldValue.delete' })),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logDebug: vi.fn(),
}));

const applyPatch = (current: StoreRecord, patch: StoreRecord): StoreRecord => {
  const next = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if ((value as { _methodName?: string } | undefined)?._methodName === 'FieldValue.serverTimestamp') {
      next[key] = Date.now();
      continue;
    }
    if ((value as { _methodName?: string } | undefined)?._methodName === 'FieldValue.delete') {
      delete next[key];
      continue;
    }
    next[key] = value;
  }

  return next;
};

const createDocRef = (id: string): MockDocRef => ({
  id,
  get: async () => {
    if (mocks.malformedDocIds.has(id)) {
      return {
        exists: true,
        data: () => undefined,
      };
    }

    const record = mocks.records.get(id);
    return {
      exists: Boolean(record),
      data: () => (record ? { ...record } : undefined),
    };
  },
  set: async (data: StoreRecord, options?: { merge?: boolean }) => {
    if (mocks.failSetDocIds.has(id)) {
      throw new Error('db unavailable');
    }

    const current = mocks.records.get(id) ?? {};
    mocks.records.set(id, options?.merge ? applyPatch(current, data) : applyPatch({}, data));
  },
});

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      warn: mocks.logWarn,
      info: mocks.logInfo,
      debug: mocks.logDebug,
      error: vi.fn(),
    })),
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
    runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) => {
      const transaction = {
        get: (docRef: MockDocRef) => docRef.get(),
        set: (docRef: MockDocRef, data: StoreRecord, options?: { merge?: boolean }) =>
          docRef.set(data, options),
      };
      return await fn(transaction);
    },
  }),
}));

import {
  RequestIdempotencyService,
  resolveVideoGenerateIdempotencyMode,
} from '../RequestIdempotencyService';

const stableStringify = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return JSON.stringify(value);
  }
  if (valueType === 'bigint') {
    return JSON.stringify((value as bigint).toString());
  }
  if (valueType === 'undefined') {
    return '""';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (valueType === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(String(value));
};

const hashSha256 = (input: string): string => createHash('sha256').update(input).digest('hex');
const toRecordId = (userId: string, route: string, key: string): string => hashSha256(`${userId}|${route}|${key}`);
const toPayloadHash = (payload: unknown): string => hashSha256(stableStringify(payload));

const createExecutor = (): FirestoreCircuitExecutor =>
  ({
    executeWrite: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => await fn()),
  }) as unknown as FirestoreCircuitExecutor;

describe('RequestIdempotencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'));
    mocks.records.clear();
    mocks.malformedDocIds.clear();
    mocks.failSetDocIds.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('claims a new request and persists a pending lock through the circuit executor', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor, {
      pendingLockTtlMs: 60_000,
      replayTtlMs: 3_600_000,
    });
    const payload = { prompt: 'runner in rain', model: 'sora-2' };

    const result = await service.claimRequest({
      userId: 'user-1',
      route: '/api/video/generate',
      key: 'idem-1',
      payload,
    });

    expect((executor.executeWrite as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'idempotency.claimRequest',
      expect.any(Function)
    );
    expect(result).toMatchObject({ state: 'claimed' });
    expect(mocks.records.get(result.recordId)).toMatchObject({
      key: 'idem-1',
      userId: 'user-1',
      route: '/api/video/generate',
      payloadHash: toPayloadHash(payload),
      status: 'pending',
      lockExpiresAtMs: Date.now() + 60_000,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
  });

  it('replays a completed request with a matching payload hash', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor);
    const payload = { prompt: 'sunset beach', model: 'sora-2' };
    const recordId = toRecordId('user-1', '/api/video/generate', 'idem-2');

    mocks.records.set(recordId, {
      key: 'idem-2',
      userId: 'user-1',
      route: '/api/video/generate',
      payloadHash: toPayloadHash(payload),
      status: 'completed',
      responseSnapshot: {
        statusCode: 202,
        body: {
          success: true,
          jobId: 'job-123',
        },
      },
    });

    const result = await service.claimRequest({
      userId: 'user-1',
      route: '/api/video/generate',
      key: 'idem-2',
      payload,
    });

    expect(result).toEqual({
      state: 'replay',
      recordId,
      snapshot: {
        statusCode: 202,
        body: {
          success: true,
          jobId: 'job-123',
        },
      },
    });
  });

  it('rejects a reused key when the payload hash differs', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor);
    const recordId = toRecordId('user-1', '/api/video/generate', 'idem-3');

    mocks.records.set(recordId, {
      key: 'idem-3',
      userId: 'user-1',
      route: '/api/video/generate',
      payloadHash: toPayloadHash({ prompt: 'original' }),
      status: 'pending',
      lockExpiresAtMs: Date.now() + 60_000,
    });

    const result = await service.claimRequest({
      userId: 'user-1',
      route: '/api/video/generate',
      key: 'idem-3',
      payload: { prompt: 'changed' },
    });

    expect(result).toEqual({
      state: 'conflict',
      recordId,
    });
  });

  it('returns in_progress while an existing pending lock has not expired', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor);
    const payload = { prompt: 'city street' };
    const recordId = toRecordId('user-1', '/api/video/generate', 'idem-4');

    mocks.records.set(recordId, {
      key: 'idem-4',
      userId: 'user-1',
      route: '/api/video/generate',
      payloadHash: toPayloadHash(payload),
      status: 'pending',
      lockExpiresAtMs: Date.now() + 5_000,
    });

    const result = await service.claimRequest({
      userId: 'user-1',
      route: '/api/video/generate',
      key: 'idem-4',
      payload,
    });

    expect(result).toEqual({
      state: 'in_progress',
      recordId,
    });
  });

  it('reclaims expired records and clears the previous error state', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor, {
      pendingLockTtlMs: 120_000,
    });
    const payload = { prompt: 'desert storm' };
    const recordId = toRecordId('user-1', '/api/video/generate', 'idem-5');

    mocks.records.set(recordId, {
      key: 'idem-5',
      userId: 'user-1',
      route: '/api/video/generate',
      payloadHash: toPayloadHash(payload),
      status: 'failed',
      lockExpiresAtMs: Date.now() - 1,
      lastError: 'old failure',
      updatedAtMs: Date.now() - 5000,
    });

    const result = await service.claimRequest({
      userId: 'user-1',
      route: '/api/video/generate',
      key: 'idem-5',
      payload,
    });

    expect(result).toEqual({
      state: 'claimed',
      recordId,
    });
    expect(mocks.records.get(recordId)).toMatchObject({
      status: 'pending',
      lockExpiresAtMs: Date.now() + 120_000,
    });
    expect(mocks.records.get(recordId)).not.toHaveProperty('lastError');
  });

  it('treats malformed existing records as conflicts', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor);
    const recordId = toRecordId('user-1', '/api/video/generate', 'idem-6');

    mocks.malformedDocIds.add(recordId);

    const result = await service.claimRequest({
      userId: 'user-1',
      route: '/api/video/generate',
      key: 'idem-6',
      payload: { prompt: 'forest' },
    });

    expect(result).toEqual({
      state: 'conflict',
      recordId,
    });
  });

  it('marks completed requests and preserves existing fields when merging', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor, {
      replayTtlMs: 86_400_000,
    });

    mocks.records.set('record-1', {
      key: 'idem-7',
      userId: 'user-1',
    });

    await service.markCompleted({
      recordId: 'record-1',
      jobId: 'job-1',
      snapshot: {
        statusCode: 200,
        body: { success: true },
      },
    });

    expect((executor.executeWrite as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'idempotency.markCompleted',
      expect.any(Function)
    );
    expect(mocks.records.get('record-1')).toMatchObject({
      key: 'idem-7',
      userId: 'user-1',
      jobId: 'job-1',
      status: 'completed',
      responseSnapshot: {
        statusCode: 200,
        body: { success: true },
      },
    });
  });

  it('marks completed requests without adding a job id when none is supplied', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor);

    await service.markCompleted({
      recordId: 'record-2',
      snapshot: {
        statusCode: 201,
        body: { queued: true },
      },
    });

    expect(mocks.records.get('record-2')).toMatchObject({
      status: 'completed',
      responseSnapshot: {
        statusCode: 201,
        body: { queued: true },
      },
    });
    expect(mocks.records.get('record-2')).not.toHaveProperty('jobId');
  });

  it('marks failed requests, expires the lock, and wraps the write', async () => {
    const executor = createExecutor();
    const service = new RequestIdempotencyService(executor, {
      replayTtlMs: 10_000,
    });

    await service.markFailed('record-3', 'provider timeout');

    expect((executor.executeWrite as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'idempotency.markFailed',
      expect.any(Function)
    );
    expect(mocks.records.get('record-3')).toMatchObject({
      status: 'failed',
      lastError: 'provider timeout',
      lockExpiresAtMs: Date.now() - 1,
    });
  });

  it('swallows markFailed persistence errors and logs a warning', async () => {
    const executor = {
      executeWrite: vi.fn(async () => {
        throw new Error('write failed');
      }),
    } as unknown as FirestoreCircuitExecutor;
    const service = new RequestIdempotencyService(executor);

    await expect(service.markFailed('record-4', 'provider timeout')).resolves.toBeUndefined();
    expect(mocks.logWarn).toHaveBeenCalledWith(
      'Failed to clear idempotency lock after error',
      expect.objectContaining({
        recordId: 'record-4',
        reason: 'provider timeout',
        error: 'write failed',
      })
    );
  });

  it.each([
    [{}, 'required'],
    [{ VIDEO_GENERATE_IDEMPOTENCY_MODE: 'soft' }, 'soft'],
    [{ VIDEO_GENERATE_IDEMPOTENCY_MODE: 'required' }, 'required'],
  ])('resolves idempotency mode from env %#', (env, expected) => {
    expect(resolveVideoGenerateIdempotencyMode(env as NodeJS.ProcessEnv)).toBe(expected);
  });
});
