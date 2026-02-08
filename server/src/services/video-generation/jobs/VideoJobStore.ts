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

  async findJobByAssetId(assetId: string): Promise<VideoJobRecord | null> {
    const snapshot = await this.collection
      .where('result.assetId', '==', assetId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }
    return this.parseJob(doc.id, doc.data());
  }

  async failNextQueuedStaleJob(cutoffMs: number, reason: string): Promise<VideoJobRecord | null> {
    const query = this.collection
      .where('status', '==', 'queued')
      .where('createdAtMs', '<=', cutoffMs)
      .orderBy('createdAtMs', 'asc')
      .limit(1);

    return await this.failFromQuery(query, reason);
  }

  async failNextProcessingStaleJob(cutoffMs: number, reason: string): Promise<VideoJobRecord | null> {
    const query = this.collection
      .where('status', '==', 'processing')
      .where('leaseExpiresAtMs', '<=', cutoffMs)
      .orderBy('leaseExpiresAtMs', 'asc')
      .limit(1);

    return await this.failFromQuery(query, reason);
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

  async claimJob(jobId: string, workerId: string, leaseMs: number): Promise<VideoJobRecord | null> {
    return await this.db.runTransaction(async (transaction) => {
      const docRef = this.collection.doc(jobId);
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return null;
      }

      const data = snapshot.data();
      if (!data || data.status !== 'queued') {
        return null;
      }

      const now = Date.now();
      const leaseExpiresAtMs = now + leaseMs;

      transaction.update(docRef, {
        status: 'processing',
        workerId,
        leaseExpiresAtMs,
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return this.parseJob(jobId, {
        ...data,
        status: 'processing',
        workerId,
        leaseExpiresAtMs,
        updatedAtMs: now,
      });
    }).catch((error: Error) => {
      logger.error('Failed to claim video job by id', error, { jobId, workerId });
      return null;
    });
  }

  async markCompleted(jobId: string, result: VideoJobRecord['result']): Promise<boolean> {
    const now = Date.now();

    return await this.db.runTransaction(async (transaction) => {
      const docRef = this.collection.doc(jobId);
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return false;
      }

      const data = snapshot.data();
      if (!data || data.status !== 'processing') {
        return false;
      }

      transaction.update(docRef, {
        status: 'completed',
        result,
        completedAtMs: now,
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workerId: admin.firestore.FieldValue.delete(),
        leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
      });

      return true;
    }).catch((error: Error) => {
      logger.error('Failed to mark video job completed', error, { jobId });
      return false;
    });
  }

  async markFailed(jobId: string, message: string): Promise<boolean> {
    const now = Date.now();

    return await this.db.runTransaction(async (transaction) => {
      const docRef = this.collection.doc(jobId);
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return false;
      }

      const data = snapshot.data();
      if (!data || data.status === 'failed' || data.status === 'completed') {
        return false;
      }

      transaction.update(docRef, {
        status: 'failed',
        error: { message },
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workerId: admin.firestore.FieldValue.delete(),
        leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
      });

      return true;
    }).catch((error: Error) => {
      logger.error('Failed to mark video job failed', error, { jobId });
      return false;
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
      if (!doc) {
        return null;
      }
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
    const normalizedOptions = Object.fromEntries(
      Object.entries(parsed.request.options ?? {}).filter(([, value]) => value !== undefined)
    ) as VideoJobRequest['options'];
    const normalizedResult = parsed.result
      ? {
          assetId: parsed.result.assetId,
          videoUrl: parsed.result.videoUrl,
          contentType: parsed.result.contentType,
          ...(parsed.result.inputMode !== undefined
            ? { inputMode: parsed.result.inputMode }
            : {}),
          ...(parsed.result.startImageUrl !== undefined
            ? { startImageUrl: parsed.result.startImageUrl }
            : {}),
          ...(parsed.result.storagePath !== undefined
            ? { storagePath: parsed.result.storagePath }
            : {}),
          ...(parsed.result.viewUrl !== undefined
            ? { viewUrl: parsed.result.viewUrl }
            : {}),
          ...(parsed.result.viewUrlExpiresAt !== undefined
            ? { viewUrlExpiresAt: parsed.result.viewUrlExpiresAt }
            : {}),
          ...(parsed.result.sizeBytes !== undefined
            ? { sizeBytes: parsed.result.sizeBytes }
            : {}),
        }
      : undefined;

    const base: VideoJobRecord = {
      id,
      status: parsed.status,
      userId: parsed.userId,
      request: {
        ...parsed.request,
        options: normalizedOptions,
      },
      creditsReserved: parsed.creditsReserved,
      createdAtMs: parsed.createdAtMs,
      updatedAtMs: parsed.updatedAtMs,
    };

    if (typeof parsed.completedAtMs === 'number') {
      base.completedAtMs = parsed.completedAtMs;
    }
    if (normalizedResult) {
      base.result = normalizedResult;
    }
    if (parsed.error) {
      base.error = parsed.error;
    }
    if (typeof parsed.workerId === 'string') {
      base.workerId = parsed.workerId;
    }
    if (typeof parsed.leaseExpiresAtMs === 'number') {
      base.leaseExpiresAtMs = parsed.leaseExpiresAtMs;
    }

    return base;
  }

  private async failFromQuery(query: Query, reason: string): Promise<VideoJobRecord | null> {
    return await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(query);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      if (!doc) {
        return null;
      }
      const data = doc.data();
      if (!data) {
        return null;
      }

      const now = Date.now();
      transaction.update(doc.ref, {
        status: 'failed',
        error: { message: reason },
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workerId: admin.firestore.FieldValue.delete(),
        leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
      });

      return this.parseJob(doc.id, {
        ...data,
        status: 'failed',
        error: { message: reason },
        updatedAtMs: now,
      });
    }).catch((error: Error) => {
      logger.error('Failed to mark stale video job failed', error, { reason });
      return null;
    });
  }
}
