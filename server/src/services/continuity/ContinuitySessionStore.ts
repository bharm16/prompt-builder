import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import type { ContinuitySession, ContinuityShot } from './types';

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
}

export class ContinuitySessionStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('continuity_sessions');

  async save(session: ContinuitySession): Promise<void> {
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

    await docRef.set({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
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
    const createdAt = typeof raw.createdAt === 'number' ? new Date(raw.createdAt) : new Date();
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
    if (proxy) {
      (proxy as any).createdAt = createdAt;
    }
    return proxy;
  }
}
