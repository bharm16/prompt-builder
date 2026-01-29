import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { z } from 'zod';
import type { ContinuitySession, ContinuityShot } from './types';

const StoredShotSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sequenceIndex: z.number(),
  userPrompt: z.string(),
  continuityMode: z.enum(['frame-bridge', 'style-match', 'native', 'none']),
  styleStrength: z.number(),
  styleReferenceId: z.string().nullable(),
  modelId: z.string(),
  status: z.enum(['draft', 'generating-keyframe', 'generating-video', 'completed', 'failed']),
  createdAt: z.number(),
}).passthrough();

interface StoredSession {
  userId: string;
  name: string;
  description?: string;
  primaryStyleReference: Record<string, unknown>;
  sceneProxy?: Record<string, unknown>;
  shots: Array<Record<string, unknown>>;
  defaultSettings: ContinuitySession['defaultSettings'];
  status: ContinuitySession['status'];
  createdAtMs: number;
  updatedAtMs: number;
  version?: number;
}

export class ContinuitySessionVersionMismatchError extends Error {
  constructor(
    readonly sessionId: string,
    readonly expectedVersion: number,
    readonly actualVersion?: number
  ) {
    super(
      `Continuity session version mismatch for ${sessionId} (expected ${expectedVersion}, got ${actualVersion ?? 'unknown'})`
    );
    this.name = 'ContinuitySessionVersionMismatchError';
  }
}

export class ContinuitySessionStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('continuity_sessions');

  async save(session: ContinuitySession): Promise<void> {
    await this.saveInternal(session);
  }

  async saveWithVersion(session: ContinuitySession, expectedVersion: number): Promise<number> {
    return await this.saveInternal(session, expectedVersion);
  }

  private async saveInternal(session: ContinuitySession, expectedVersion?: number): Promise<number> {
    const docRef = this.collection.doc(session.id);
    const now = Date.now();

    const payload: StoredSession = {
      userId: session.userId,
      name: session.name,
      ...(typeof session.description === 'string' ? { description: session.description } : {}),
      primaryStyleReference: this.serializeStyleReference(session.primaryStyleReference),
      ...(session.sceneProxy ? { sceneProxy: this.serializeSceneProxy(session.sceneProxy) } : {}),
      shots: session.shots.map((shot) => this.serializeShot(shot)),
      defaultSettings: session.defaultSettings,
      status: session.status,
      createdAtMs: session.createdAt.getTime(),
      updatedAtMs: now,
    };

    if (typeof expectedVersion === 'number') {
      const newVersion = expectedVersion + 1;
      await this.db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(docRef);
        if (!docSnapshot.exists) {
          throw new ContinuitySessionVersionMismatchError(session.id, expectedVersion, undefined);
        }
        const stored = docSnapshot.data() as StoredSession | undefined;
        const actualVersion = stored?.version;
        if (typeof actualVersion === 'number' && actualVersion !== expectedVersion) {
          throw new ContinuitySessionVersionMismatchError(session.id, expectedVersion, actualVersion);
        }
        transaction.set(
          docRef,
          {
            ...payload,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: newVersion,
          },
          { merge: true }
        );
      });
      return newVersion;
    }

    const docSnapshot = await docRef.get();
    if (docSnapshot.exists) {
      await docRef.set(
        {
          ...payload,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          version: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      );
      const stored = docSnapshot.data() as StoredSession | undefined;
      return typeof stored?.version === 'number' ? stored.version + 1 : 1;
    }

    await docRef.set({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      version: 1,
    });
    return 1;
  }

  async get(sessionId: string): Promise<ContinuitySession | null> {
    const snapshot = await this.collection.doc(sessionId).get();
    if (!snapshot.exists) {
      return null;
    }

    return this.fromStored(sessionId, snapshot.data() as StoredSession);
  }

  async findByUser(userId: string): Promise<ContinuitySession[]> {
    const snapshot = await this.collection.where('userId', '==', userId).orderBy('updatedAtMs', 'desc').get();
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => this.fromStored(doc.id, doc.data() as StoredSession));
  }

  async delete(sessionId: string): Promise<void> {
    await this.collection.doc(sessionId).delete();
  }

  private fromStored(sessionId: string, stored: StoredSession): ContinuitySession {
    const sceneProxy = stored.sceneProxy ? this.deserializeSceneProxy(stored.sceneProxy) : undefined;
    const storedRecord = stored as unknown as Record<string, unknown>;
    const version = typeof storedRecord.version === 'number'
      ? storedRecord.version
      : undefined;
    return {
      id: sessionId,
      userId: stored.userId,
      name: stored.name,
      ...(typeof stored.description === 'string' ? { description: stored.description } : {}),
      primaryStyleReference: this.deserializeStyleReference(stored.primaryStyleReference),
      ...(sceneProxy ? { sceneProxy } : {}),
      shots: stored.shots.map((shot) => this.deserializeShot(shot)),
      defaultSettings: stored.defaultSettings,
      status: stored.status,
      ...(version !== undefined ? { version } : {}),
      createdAt: new Date(stored.createdAtMs),
      updatedAt: new Date(stored.updatedAtMs),
    };
  }

  private serializeShot(shot: ContinuityShot): Record<string, unknown> {
    return {
      ...shot,
      createdAt: shot.createdAt.getTime(),
      generatedAt: shot.generatedAt ? shot.generatedAt.getTime() : undefined,
      frameBridge: shot.frameBridge
        ? {
            ...shot.frameBridge,
            extractedAt: shot.frameBridge.extractedAt.getTime(),
          }
        : undefined,
      styleReference: shot.styleReference ? this.serializeStyleReference(shot.styleReference) : undefined,
      seedInfo: shot.seedInfo
        ? {
            ...shot.seedInfo,
            extractedAt: shot.seedInfo.extractedAt.getTime(),
          }
        : undefined,
    };
  }

  private deserializeShot(raw: Record<string, unknown>): ContinuityShot {
    const parsed = StoredShotSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid shot data in Firestore: ${parsed.error.message}`);
    }

    const data = parsed.data;
    const createdAt = new Date(data.createdAt);
    const generatedAt =
      typeof raw.generatedAt === 'number' ? new Date(raw.generatedAt) : undefined;
    const seedInfoRaw = raw.seedInfo as Record<string, unknown> | undefined;
    const frameBridgeRaw = raw.frameBridge as Record<string, unknown> | undefined;
    const seedInfo =
      seedInfoRaw && typeof seedInfoRaw.seed === 'number'
        ? {
            seed: seedInfoRaw.seed as number,
            provider: String(seedInfoRaw.provider || ''),
            modelId: String(seedInfoRaw.modelId || ''),
            extractedAt:
              typeof seedInfoRaw.extractedAt === 'number'
                ? new Date(seedInfoRaw.extractedAt)
                : new Date(),
          }
        : undefined;

    const styleReferenceRaw = raw.styleReference as Record<string, unknown> | undefined;

    const shot = raw as unknown as ContinuityShot;
    shot.createdAt = createdAt;
    if (generatedAt) {
      shot.generatedAt = generatedAt;
    }
    if (seedInfo) {
      shot.seedInfo = seedInfo;
    }
    if (frameBridgeRaw) {
      shot.frameBridge = {
        ...(frameBridgeRaw as Record<string, unknown>),
        extractedAt:
          typeof frameBridgeRaw.extractedAt === 'number'
            ? new Date(frameBridgeRaw.extractedAt)
            : new Date(),
      } as NonNullable<ContinuityShot['frameBridge']>;
    }
    if (styleReferenceRaw) {
      shot.styleReference = this.deserializeStyleReference(styleReferenceRaw);
    }

    return shot;
  }

  private serializeStyleReference(ref: ContinuitySession['primaryStyleReference']): Record<string, unknown> {
    return {
      ...ref,
      extractedAt: ref.extractedAt.getTime(),
    };
  }

  private deserializeStyleReference(raw: Record<string, unknown>): ContinuitySession['primaryStyleReference'] {
    const extractedAt = typeof raw.extractedAt === 'number' ? new Date(raw.extractedAt) : new Date();
    const ref = raw as unknown as ContinuitySession['primaryStyleReference'];
    ref.extractedAt = extractedAt;
    return ref;
  }

  private serializeSceneProxy(proxy: ContinuitySession['sceneProxy']): Record<string, unknown> {
    return {
      ...proxy,
      createdAt: proxy?.createdAt ? proxy.createdAt.getTime() : Date.now(),
    };
  }

  private deserializeSceneProxy(raw: Record<string, unknown>): ContinuitySession['sceneProxy'] {
    const createdAt = typeof raw.createdAt === 'number' ? new Date(raw.createdAt) : new Date();
    const proxy = raw as unknown as ContinuitySession['sceneProxy'];
    if (!proxy) {
      return proxy;
    }
    return { ...proxy, createdAt };
  }
}
