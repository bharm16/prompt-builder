import type { DocumentData, Query } from 'firebase-admin/firestore';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import { VideoJobRecordSchema } from './schemas';
import type { VideoJobError, VideoJobRecord, VideoJobRequest } from './types';

const DEFAULT_MAX_ATTEMPTS = 3;
const SLOW_FIRESTORE_OPERATION_MS = 1_000;

interface CreateJobInput {
  userId: string;
  request: VideoJobRequest;
  creditsReserved: number;
  maxAttempts?: number;
}

type DeadLetterSource =
  | 'worker-terminal'
  | 'sweeper-stale'
  | 'shutdown-release'
  | 'manual-release'
  | 'inline-terminal';

type VideoJobErrorInput =
  | string
  | {
      message: string;
      code?: string | undefined;
      category?: VideoJobError['category'] | undefined;
      retryable?: boolean | undefined;
      stage?: VideoJobError['stage'] | undefined;
      provider?: string | undefined;
      attempt?: number | undefined;
    };

function toVideoJobError(error: VideoJobErrorInput): VideoJobError {
  if (typeof error === 'string') {
    return { message: error };
  }
  return {
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(error.category ? { category: error.category } : {}),
    ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    ...(error.stage ? { stage: error.stage } : {}),
    ...(error.provider ? { provider: error.provider } : {}),
    ...(typeof error.attempt === 'number' ? { attempt: error.attempt } : {}),
  };
}

function resolvePositiveInt(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Number.parseInt(String(value), 10) : fallback;
}

function resolveDefaultMaxAttempts(): number {
  const fromEnv = Number.parseInt(process.env.VIDEO_JOB_MAX_ATTEMPTS || '', 10);
  return resolvePositiveInt(fromEnv, DEFAULT_MAX_ATTEMPTS);
}

export class VideoJobStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('video_jobs');
  private readonly deadLetterCollection = this.db.collection('video_job_dlq');
  private readonly log = logger.child({ service: 'VideoJobStore' });

  private async withTiming<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      return await fn();
    } finally {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= SLOW_FIRESTORE_OPERATION_MS) {
        this.log.warn('Slow Firestore job operation', { operation, durationMs });
      } else {
        this.log.debug('Firestore job operation completed', { operation, durationMs });
      }
    }
  }

  async createJob(input: CreateJobInput): Promise<VideoJobRecord> {
    const now = Date.now();
    const docRef = this.collection.doc();
    const maxAttempts = resolvePositiveInt(input.maxAttempts, resolveDefaultMaxAttempts());

    const record = {
      status: 'queued',
      userId: input.userId,
      request: input.request,
      creditsReserved: input.creditsReserved,
      attempts: 0,
      maxAttempts,
      createdAtMs: now,
      updatedAtMs: now,
    };

    await this.withTiming('createJob', async () => {
      await docRef.set({
        ...record,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return this.parseJob(docRef.id, record);
  }

  async getJob(jobId: string): Promise<VideoJobRecord | null> {
    const snapshot = await this.withTiming('getJob', async () => this.collection.doc(jobId).get());
    if (!snapshot.exists) {
      return null;
    }
    return this.parseJob(snapshot.id, snapshot.data());
  }

  async findJobByAssetId(assetId: string): Promise<VideoJobRecord | null> {
    const snapshot = await this.withTiming('findJobByAssetId', async () =>
      this.collection.where('result.assetId', '==', assetId).limit(1).get()
    );

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

    return await this.failFromQuery(query, {
      message: reason,
      code: 'VIDEO_JOB_STALE_QUEUED',
      category: 'timeout',
      retryable: false,
      stage: 'sweeper',
    });
  }

  async failNextProcessingStaleJob(cutoffMs: number, reason: string): Promise<VideoJobRecord | null> {
    const query = this.collection
      .where('status', '==', 'processing')
      .where('leaseExpiresAtMs', '<=', cutoffMs)
      .orderBy('leaseExpiresAtMs', 'asc')
      .limit(1);

    return await this.failFromQuery(query, {
      message: reason,
      code: 'VIDEO_JOB_STALE_PROCESSING',
      category: 'timeout',
      retryable: false,
      stage: 'sweeper',
    });
  }

  async claimNextJob(workerId: string, leaseMs: number): Promise<VideoJobRecord | null> {
    const queuedQuery = this.collection.where('status', '==', 'queued').orderBy('createdAtMs', 'asc').limit(1);

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
    return await this.withTiming('claimJob', async () =>
      this.db
        .runTransaction(async (transaction) => {
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
          const attempts =
            typeof data.attempts === 'number' && Number.isFinite(data.attempts) ? data.attempts + 1 : 1;
          const maxAttempts = resolvePositiveInt(
            typeof data.maxAttempts === 'number' ? data.maxAttempts : undefined,
            resolveDefaultMaxAttempts()
          );

          transaction.update(docRef, {
            status: 'processing',
            workerId,
            attempts,
            maxAttempts,
            leaseExpiresAtMs,
            lastHeartbeatAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            releasedAtMs: admin.firestore.FieldValue.delete(),
            releaseReason: admin.firestore.FieldValue.delete(),
          });

          return this.parseJob(jobId, {
            ...data,
            status: 'processing',
            workerId,
            attempts,
            maxAttempts,
            leaseExpiresAtMs,
            lastHeartbeatAtMs: now,
            updatedAtMs: now,
          });
        })
        .catch((error: Error) => {
          logger.error('Failed to claim video job by id', error, { jobId, workerId });
          return null;
        })
    );
  }

  async renewLease(jobId: string, workerId: string, leaseMs: number): Promise<boolean> {
    return await this.withTiming('renewLease', async () =>
      this.db
        .runTransaction(async (transaction) => {
          const docRef = this.collection.doc(jobId);
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) {
            return false;
          }

          const data = snapshot.data();
          if (!data || data.status !== 'processing' || data.workerId !== workerId) {
            return false;
          }

          const now = Date.now();
          transaction.update(docRef, {
            leaseExpiresAtMs: now + leaseMs,
            lastHeartbeatAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return true;
        })
        .catch((error: Error) => {
          logger.error('Failed to renew video job lease', error, { jobId, workerId });
          return false;
        })
    );
  }

  async releaseClaim(jobId: string, workerId: string, reason: string): Promise<boolean> {
    return await this.withTiming('releaseClaim', async () =>
      this.db
        .runTransaction(async (transaction) => {
          const docRef = this.collection.doc(jobId);
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) {
            return false;
          }

          const data = snapshot.data();
          if (!data || data.status !== 'processing' || data.workerId !== workerId) {
            return false;
          }

          const now = Date.now();
          transaction.update(docRef, {
            status: 'queued',
            releasedAtMs: now,
            releaseReason: reason,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            workerId: admin.firestore.FieldValue.delete(),
            leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
            lastHeartbeatAtMs: admin.firestore.FieldValue.delete(),
          });

          return true;
        })
        .catch((error: Error) => {
          logger.error('Failed to release claimed video job', error, { jobId, workerId, reason });
          return false;
        })
    );
  }

  async requeueForRetry(jobId: string, workerId: string, error: VideoJobError): Promise<boolean> {
    const normalizedError = toVideoJobError(error);
    return await this.withTiming('requeueForRetry', async () =>
      this.db
        .runTransaction(async (transaction) => {
          const docRef = this.collection.doc(jobId);
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) {
            return false;
          }

          const data = snapshot.data();
          if (!data || data.status !== 'processing' || data.workerId !== workerId) {
            return false;
          }

          const now = Date.now();
          transaction.update(docRef, {
            status: 'queued',
            error: normalizedError,
            releasedAtMs: now,
            releaseReason: 'retry',
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            workerId: admin.firestore.FieldValue.delete(),
            leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
            lastHeartbeatAtMs: admin.firestore.FieldValue.delete(),
          });

          return true;
        })
        .catch((txError: Error) => {
          logger.error('Failed to requeue video job for retry', txError, { jobId, workerId });
          return false;
        })
    );
  }

  async markCompleted(jobId: string, result: VideoJobRecord['result']): Promise<boolean> {
    const now = Date.now();

    return await this.withTiming('markCompleted', async () =>
      this.db
        .runTransaction(async (transaction) => {
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
            lastHeartbeatAtMs: admin.firestore.FieldValue.delete(),
          });

          return true;
        })
        .catch((error: Error) => {
          logger.error('Failed to mark video job completed', error, { jobId });
          return false;
        })
    );
  }

  async markFailed(jobId: string, error: VideoJobErrorInput): Promise<boolean> {
    const now = Date.now();
    const normalizedError = toVideoJobError(error);

    return await this.withTiming('markFailed', async () =>
      this.db
        .runTransaction(async (transaction) => {
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
            error: normalizedError,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            workerId: admin.firestore.FieldValue.delete(),
            leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
            lastHeartbeatAtMs: admin.firestore.FieldValue.delete(),
          });

          return true;
        })
        .catch((txError: Error) => {
          logger.error('Failed to mark video job failed', txError, { jobId });
          return false;
        })
    );
  }

  async enqueueDeadLetter(
    job: VideoJobRecord,
    error: VideoJobError,
    source: DeadLetterSource
  ): Promise<void> {
    const now = Date.now();
    const normalizedError = toVideoJobError(error);
    await this.withTiming('enqueueDeadLetter', async () => {
      await this.deadLetterCollection.doc(job.id).set(
        {
          jobId: job.id,
          userId: job.userId,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          request: job.request,
          creditsReserved: job.creditsReserved,
          error: normalizedError,
          source,
          createdAtMs: now,
          updatedAtMs: now,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  private async claimFromQuery(query: Query, workerId: string, leaseMs: number): Promise<VideoJobRecord | null> {
    return await this.withTiming('claimFromQuery', async () =>
      this.db
        .runTransaction(async (transaction) => {
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
          const attempts =
            typeof data.attempts === 'number' && Number.isFinite(data.attempts) ? data.attempts + 1 : 1;
          const maxAttempts = resolvePositiveInt(
            typeof data.maxAttempts === 'number' ? data.maxAttempts : undefined,
            resolveDefaultMaxAttempts()
          );

          transaction.update(doc.ref, {
            status: 'processing',
            workerId,
            attempts,
            maxAttempts,
            leaseExpiresAtMs,
            lastHeartbeatAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            releasedAtMs: admin.firestore.FieldValue.delete(),
            releaseReason: admin.firestore.FieldValue.delete(),
          });

          return this.parseJob(doc.id, {
            ...data,
            status: 'processing',
            workerId,
            attempts,
            maxAttempts,
            leaseExpiresAtMs,
            lastHeartbeatAtMs: now,
            updatedAtMs: now,
          });
        })
        .catch((error: Error) => {
          logger.error('Failed to claim video job', error);
          return null;
        })
    );
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
          ...(parsed.result.inputMode !== undefined ? { inputMode: parsed.result.inputMode } : {}),
          ...(parsed.result.startImageUrl !== undefined ? { startImageUrl: parsed.result.startImageUrl } : {}),
          ...(parsed.result.storagePath !== undefined ? { storagePath: parsed.result.storagePath } : {}),
          ...(parsed.result.viewUrl !== undefined ? { viewUrl: parsed.result.viewUrl } : {}),
          ...(parsed.result.viewUrlExpiresAt !== undefined
            ? { viewUrlExpiresAt: parsed.result.viewUrlExpiresAt }
            : {}),
          ...(parsed.result.sizeBytes !== undefined ? { sizeBytes: parsed.result.sizeBytes } : {}),
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
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      maxAttempts: resolvePositiveInt(
        typeof parsed.maxAttempts === 'number' ? parsed.maxAttempts : undefined,
        resolveDefaultMaxAttempts()
      ),
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
      base.error = toVideoJobError(parsed.error);
    }
    if (typeof parsed.workerId === 'string') {
      base.workerId = parsed.workerId;
    }
    if (typeof parsed.leaseExpiresAtMs === 'number') {
      base.leaseExpiresAtMs = parsed.leaseExpiresAtMs;
    }
    if (typeof parsed.lastHeartbeatAtMs === 'number') {
      base.lastHeartbeatAtMs = parsed.lastHeartbeatAtMs;
    }
    if (typeof parsed.releasedAtMs === 'number') {
      base.releasedAtMs = parsed.releasedAtMs;
    }
    if (typeof parsed.releaseReason === 'string') {
      base.releaseReason = parsed.releaseReason;
    }

    return base;
  }

  private async failFromQuery(query: Query, error: VideoJobError): Promise<VideoJobRecord | null> {
    const normalizedError = toVideoJobError(error);
    return await this.withTiming('failFromQuery', async () =>
      this.db
        .runTransaction(async (transaction) => {
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
            error: normalizedError,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            workerId: admin.firestore.FieldValue.delete(),
            leaseExpiresAtMs: admin.firestore.FieldValue.delete(),
            lastHeartbeatAtMs: admin.firestore.FieldValue.delete(),
          });

          return this.parseJob(doc.id, {
            ...data,
            status: 'failed',
            error: normalizedError,
            updatedAtMs: now,
          });
        })
        .catch((txError: Error) => {
          logger.error('Failed to mark stale video job failed', txError, {
            reason: normalizedError.message,
            code: normalizedError.code,
          });
          return null;
        })
    );
  }
}
