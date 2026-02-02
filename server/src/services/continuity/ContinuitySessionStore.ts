import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import type { ContinuitySession } from './types';
import {
  deserializeContinuitySession,
  serializeContinuitySession,
  type StoredContinuitySession,
} from './continuitySerialization';
import { SessionStore } from '@services/sessions/SessionStore';
import type { SessionRecord } from '@services/sessions/types';

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
  private readonly legacyCollection = this.db.collection('continuity_sessions');
  private readonly sessionStore = new SessionStore();

  async save(session: ContinuitySession): Promise<void> {
    await this.saveInternal(session);
  }

  async saveWithVersion(session: ContinuitySession, expectedVersion: number): Promise<number> {
    return await this.saveInternal(session, expectedVersion);
  }

  private async saveInternal(session: ContinuitySession, expectedVersion?: number): Promise<number> {
    const docRef = this.legacyCollection.doc(session.id);
    const now = Date.now();

    const payload: StoredContinuitySession = {
      ...serializeContinuitySession(session),
      updatedAtMs: now,
    };

    const unifiedSession: SessionRecord = {
      id: session.id,
      userId: session.userId,
      name: session.name,
      ...(session.description ? { description: session.description } : {}),
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: new Date(now),
      continuity: session,
      hasContinuity: true,
    };

    await this.sessionStore.save(unifiedSession);

    if (typeof expectedVersion === 'number') {
      const newVersion = expectedVersion + 1;
      await this.db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(docRef);
        if (!docSnapshot.exists) {
          throw new ContinuitySessionVersionMismatchError(session.id, expectedVersion, undefined);
        }
        const stored = docSnapshot.data() as StoredContinuitySession | undefined;
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
      const stored = docSnapshot.data() as StoredContinuitySession | undefined;
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
    const unified = await this.sessionStore.get(sessionId);
    if (unified?.continuity) {
      return unified.continuity;
    }

    const snapshot = await this.legacyCollection.doc(sessionId).get();
    if (!snapshot.exists) {
      return null;
    }

    const legacy = deserializeContinuitySession(
      sessionId,
      snapshot.data() as StoredContinuitySession
    );
    await this.sessionStore.save({
      id: legacy.id,
      userId: legacy.userId,
      name: legacy.name,
      ...(legacy.description ? { description: legacy.description } : {}),
      status: legacy.status,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      continuity: legacy,
      hasContinuity: true,
    });
    return legacy;
  }

  async findByUser(userId: string): Promise<ContinuitySession[]> {
    const unifiedSessions = await this.sessionStore.findContinuityByUser(userId);
    if (unifiedSessions.length > 0) {
      return unifiedSessions
        .map((session) => session.continuity)
        .filter((session): session is ContinuitySession => Boolean(session));
    }

    const snapshot = await this.legacyCollection.where('userId', '==', userId).orderBy('updatedAtMs', 'desc').get();
    if (snapshot.empty) return [];

    const legacySessions = snapshot.docs.map(doc =>
      deserializeContinuitySession(doc.id, doc.data() as StoredContinuitySession)
    );
    for (const legacy of legacySessions) {
      await this.sessionStore.save({
        id: legacy.id,
        userId: legacy.userId,
        name: legacy.name,
        ...(legacy.description ? { description: legacy.description } : {}),
        status: legacy.status,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
        continuity: legacy,
        hasContinuity: true,
      });
    }
    return legacySessions;
  }

  async delete(sessionId: string): Promise<void> {
    await this.legacyCollection.doc(sessionId).delete();
    await this.sessionStore.delete(sessionId);
  }
}
