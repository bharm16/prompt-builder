import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import {
  FirestoreCircuitExecutor,
  getFirestoreCircuitExecutor,
} from '@services/firestore/FirestoreCircuitExecutor';

interface VideoWorkerHeartbeatRecord {
  workerId: string;
  status: 'active' | 'stopped';
  lastHeartbeatAtMs: number;
  stoppedAtMs?: number;
  hostname?: string;
  processRole?: string;
}

export interface VideoWorkerHeartbeatSummary {
  activeWorkerCount: number;
  oldestHeartbeatAgeMs: number | null;
}

interface WorkerHeartbeatMetadata {
  hostname?: string;
  processRole?: string;
}

export class VideoWorkerHeartbeatStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('video_worker_heartbeats');
  private readonly firestoreCircuitExecutor: FirestoreCircuitExecutor;

  constructor(firestoreCircuitExecutor: FirestoreCircuitExecutor = getFirestoreCircuitExecutor()) {
    this.firestoreCircuitExecutor = firestoreCircuitExecutor;
  }

  async reportHeartbeat(workerId: string, metadata?: WorkerHeartbeatMetadata): Promise<void> {
    const now = Date.now();
    await this.firestoreCircuitExecutor.executeWrite(
      'videoWorkerHeartbeatStore.reportHeartbeat',
      async () =>
        await this.collection.doc(workerId).set(
          {
            workerId,
            status: 'active' as const,
            lastHeartbeatAtMs: now,
            ...(metadata?.hostname ? { hostname: metadata.hostname } : {}),
            ...(metadata?.processRole ? { processRole: metadata.processRole } : {}),
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
    );
  }

  async markStopped(workerId: string): Promise<void> {
    const now = Date.now();
    await this.firestoreCircuitExecutor.executeWrite(
      'videoWorkerHeartbeatStore.markStopped',
      async () =>
        await this.collection.doc(workerId).set(
          {
            workerId,
            status: 'stopped' as const,
            stoppedAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
    );
  }

  async getActiveWorkerSummary(maxHeartbeatAgeMs: number): Promise<VideoWorkerHeartbeatSummary> {
    try {
      const snapshot = await this.firestoreCircuitExecutor.executeRead(
        'videoWorkerHeartbeatStore.getActiveWorkerSummary',
        async () => await this.collection.where('status', '==', 'active').get()
      );

      if (snapshot.empty) {
        return { activeWorkerCount: 0, oldestHeartbeatAgeMs: null };
      }

      const now = Date.now();
      let activeWorkerCount = 0;
      let oldestHeartbeatAtMs = Number.POSITIVE_INFINITY;

      for (const doc of snapshot.docs) {
        const data = doc.data() as VideoWorkerHeartbeatRecord;
        if (
          typeof data.lastHeartbeatAtMs !== 'number' ||
          !Number.isFinite(data.lastHeartbeatAtMs)
        ) {
          continue;
        }
        if (now - data.lastHeartbeatAtMs > maxHeartbeatAgeMs) {
          continue;
        }
        activeWorkerCount += 1;
        oldestHeartbeatAtMs = Math.min(oldestHeartbeatAtMs, data.lastHeartbeatAtMs);
      }

      if (activeWorkerCount === 0) {
        return { activeWorkerCount: 0, oldestHeartbeatAgeMs: null };
      }

      return {
        activeWorkerCount,
        oldestHeartbeatAgeMs:
          oldestHeartbeatAtMs === Number.POSITIVE_INFINITY ? null : Math.max(0, now - oldestHeartbeatAtMs),
      };
    } catch (error) {
      logger.warn('Failed to read video worker heartbeat summary', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { activeWorkerCount: 0, oldestHeartbeatAgeMs: null };
    }
  }
}
