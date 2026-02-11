import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContinuitySession } from '../types';
import { serializeContinuitySession } from '../continuitySerialization';

type StoreRecord = Record<string, unknown>;

const applyPatch = (current: StoreRecord, patch: StoreRecord): StoreRecord => {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if ((value as { _methodName?: string } | undefined)?._methodName === 'FieldValue.serverTimestamp') {
      next[key] = Date.now();
      continue;
    }
    if ((value as { _methodName?: string; operand?: number } | undefined)?._methodName === 'FieldValue.increment') {
      const previous = Number(next[key] ?? 0);
      next[key] = previous + Number((value as { operand?: number }).operand ?? 0);
      continue;
    }
    next[key] = value;
  }
  return next;
};

const mocks = vi.hoisted(() => ({
  legacyRecords: new Map<string, StoreRecord>(),
  sessionStore: {
    save: vi.fn(),
    get: vi.fn(),
    findContinuityByUser: vi.fn(),
    delete: vi.fn(),
  },
  serverTimestamp: vi.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
  increment: vi.fn((operand: number) => ({ _methodName: 'FieldValue.increment', operand })),
}));

const createLegacyDocRef = (id: string) => ({
  id,
  get: async () => {
    const record = mocks.legacyRecords.get(id);
    return {
      exists: Boolean(record),
      data: () => (record ? { ...record } : undefined),
    };
  },
  set: async (data: StoreRecord, options?: { merge?: boolean }) => {
    const current = mocks.legacyRecords.get(id);
    if (options?.merge && current) {
      mocks.legacyRecords.set(id, applyPatch(current, data));
      return;
    }
    mocks.legacyRecords.set(id, applyPatch({}, data));
  },
  delete: async () => {
    mocks.legacyRecords.delete(id);
  },
});

vi.mock('@services/sessions/SessionStore', () => ({
  SessionStore: vi.fn().mockImplementation(() => mocks.sessionStore),
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: mocks.serverTimestamp,
        increment: mocks.increment,
      },
    },
  },
  getFirestore: () => ({
    collection: (name: string) => {
      if (name !== 'continuity_sessions') {
        throw new Error(`Unexpected collection: ${name}`);
      }
      return {
        doc: (id: string) => createLegacyDocRef(id),
        where: (_field: string, _operator: string, value: unknown) => ({
          orderBy: () => ({
            get: async () => {
              const docs = Array.from(mocks.legacyRecords.entries())
                .filter(([, record]) => record.userId === value)
                .map(([id, record]) => ({
                  id,
                  data: () => ({ ...record }),
                }));
              return {
                empty: docs.length === 0,
                docs,
              };
            },
          }),
        }),
      };
    },
    runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: (docRef: ReturnType<typeof createLegacyDocRef>) => docRef.get(),
        set: (
          docRef: ReturnType<typeof createLegacyDocRef>,
          data: StoreRecord,
          options?: { merge?: boolean }
        ) => docRef.set(data, options),
      };
      await fn(tx);
    },
  }),
}));

import {
  ContinuitySessionStore,
  ContinuitySessionVersionMismatchError,
} from '../ContinuitySessionStore';

const buildSession = (overrides: Partial<ContinuitySession> = {}): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  primaryStyleReference: {
    id: 'style-1',
    sourceVideoId: 'video-1',
    sourceFrameIndex: 0,
    frameUrl: 'https://example.com/style.png',
    frameTimestamp: 0,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  shots: [],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'frame-bridge',
    defaultStyleStrength: 0.6,
    defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
    autoExtractFrameBridge: false,
    useCharacterConsistency: false,
  },
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ContinuitySessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.legacyRecords.clear();
    mocks.sessionStore.get.mockResolvedValue(null);
    mocks.sessionStore.findContinuityByUser.mockResolvedValue([]);
  });

  it('saves new sessions to unified and legacy stores', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();

    await store.save(session);

    const legacy = mocks.legacyRecords.get(session.id);
    expect(legacy).toBeDefined();
    expect(legacy?.userId).toBe('user-1');
    expect(legacy?.version).toBe(1);
    expect(mocks.sessionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: session.id,
        hasContinuity: true,
        continuity: session,
      })
    );
  });

  it('increments legacy version when saving existing sessions', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();
    mocks.legacyRecords.set(session.id, {
      ...serializeContinuitySession(session),
      createdAtMs: session.createdAt.getTime(),
      updatedAtMs: session.updatedAt.getTime(),
      version: 4,
    });

    await store.save(session);

    expect(mocks.legacyRecords.get(session.id)?.version).toBe(5);
  });

  it('supports optimistic versioned save and rejects mismatches', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();

    mocks.legacyRecords.set(session.id, {
      ...serializeContinuitySession(session),
      createdAtMs: session.createdAt.getTime(),
      updatedAtMs: session.updatedAt.getTime(),
      version: 1,
    });

    await expect(store.saveWithVersion(session, 1)).resolves.toBe(2);

    await expect(store.saveWithVersion(session, 1)).rejects.toBeInstanceOf(
      ContinuitySessionVersionMismatchError
    );
  });

  it('returns unified continuity session when available', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();
    mocks.sessionStore.get.mockResolvedValueOnce({
      id: session.id,
      userId: session.userId,
      status: 'active',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      continuity: session,
      hasContinuity: true,
    });

    const result = await store.get(session.id);

    expect(result).toBe(session);
  });

  it('falls back to legacy get and backfills unified store', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();

    mocks.legacyRecords.set(session.id, {
      ...serializeContinuitySession(session),
      createdAtMs: session.createdAt.getTime(),
      updatedAtMs: session.updatedAt.getTime(),
      version: 2,
    });

    const result = await store.get(session.id);

    expect(result?.id).toBe(session.id);
    expect(result?.version).toBe(2);
    expect(mocks.sessionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: session.id, hasContinuity: true })
    );
  });

  it('uses unified findByUser first and falls back to legacy with backfill', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();

    mocks.sessionStore.findContinuityByUser.mockResolvedValueOnce([
      {
        id: session.id,
        userId: session.userId,
        status: 'active',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        continuity: session,
        hasContinuity: true,
      },
    ]);

    await expect(store.findByUser(session.userId)).resolves.toEqual([session]);

    mocks.sessionStore.findContinuityByUser.mockResolvedValueOnce([]);
    mocks.legacyRecords.set('legacy-1', {
      ...serializeContinuitySession(buildSession({ id: 'legacy-1' })),
      createdAtMs: session.createdAt.getTime(),
      updatedAtMs: session.updatedAt.getTime(),
      version: 1,
    });

    const fallback = await store.findByUser(session.userId);

    expect(fallback).toHaveLength(1);
    expect(fallback[0]?.id).toBe('legacy-1');
    expect(mocks.sessionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legacy-1', hasContinuity: true })
    );
  });

  it('deletes from legacy and unified stores', async () => {
    const store = new ContinuitySessionStore();
    const session = buildSession();
    mocks.legacyRecords.set(session.id, {
      ...serializeContinuitySession(session),
      createdAtMs: session.createdAt.getTime(),
      updatedAtMs: session.updatedAt.getTime(),
      version: 1,
    });

    await store.delete(session.id);

    expect(mocks.legacyRecords.has(session.id)).toBe(false);
    expect(mocks.sessionStore.delete).toHaveBeenCalledWith(session.id);
  });
});
