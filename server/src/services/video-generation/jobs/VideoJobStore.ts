import type { DocumentData, Query } from 'firebase-admin/firestore';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import { VideoJobRecordSchema } from './schemas';
import type { VideoJobRecord, VideoJobRequest } from './types';

interface CreateJobInput {
  userId: string;
  request: VideoJobRequest;
  creditsReserved: number;
}

export class VideoJobStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('video_jobs');

  async createJob(input: CreateJobInput): Promise<VideoJobRecord> {
    const now = Date.now();
    const docRef = this.collection.doc();

    const record = {
      status: 'queued',
      userId: input.userId,
      request: input.request,
      creditsReserved: input.creditsReserved,
      createdAtMs: now,
      updatedAtMs: now,
    };

    await docRef.set({
      ...record,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return this.parseJob(docRef.id, record);
  }

  async getJob(jobId: string): Promise<VideoJobRecord | null> {
    const snapshot = await this.collection.doc(jobId).get();
    if (!snapshot.exists) {
      return null;
    }
    return this.parseJob(snapshot.id, snapshot.data());
  }

  async claimNextJob(workerId: string, leaseMs: number): Promise<VideoJobRecord | null> {
    const queuedQuery = this.collection
      .where('status', '==', 'queued')
      .orderBy('createdAtMs', 'asc')
      .limit(1);

    const queued = await this.claimFromQuery(queuedQuery, workerId, leaseMs);
    if (queued) {
      return queued;
    }

    const now = Date.now();
    const expiredQuery = this.collection
      .where('status', '==', 'processing')
      .where('leaseExpiresAtMs', '<=', now)
      .orderBy('leaseExpiresAtMs', 'asc')
      .limit(1);

    return await this.claimFromQuery(expiredQuery, workerId, leaseMs);
  }

  async markCompleted(jobId: string, result: VideoJobRecord['result']): Promise<void> {
    const now = Date.now();
    await this.collection.doc(jobId).update({
      status: 'completed',
      result,
      completedAtMs: now,
      updatedAtMs: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workerId: admin.firestore.FieldValue.delete(),
      leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
    });
  }

  async markFailed(jobId: string, message: string): Promise<void> {
    const now = Date.now();
    await this.collection.doc(jobId).update({
      status: 'failed',
      error: { message },
      updatedAtMs: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workerId: admin.firestore.FieldValue.delete(),
      leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
    });
  }

  private async claimFromQuery(
    query: Query,
    workerId: string,
    leaseMs: number
  ): Promise<VideoJobRecord | null> {
    return await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(query);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      if (!data) {
        return null;
      }

      const now = Date.now();
      const leaseExpiresAtMs = now + leaseMs;

      transaction.update(doc.ref, {
        status: 'processing',
        workerId,
        leaseExpiresAtMs,
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return this.parseJob(doc.id, {
        ...data,
        status: 'processing',
        workerId,
        leaseExpiresAtMs,
        updatedAtMs: now,
      });
    }).catch((error: Error) => {
      logger.error('Failed to claim video job', error);
      return null;
    });
  }

  private parseJob(id: string, data: DocumentData | undefined): VideoJobRecord {
    const parsed = VideoJobRecordSchema.parse(data || {});
    return { id, ...parsed };
  }
}
