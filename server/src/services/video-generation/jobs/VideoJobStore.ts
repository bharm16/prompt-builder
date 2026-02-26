import type { DocumentData, Query } from 'firebase-admin/firestore';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import {
  FirestoreCircuitExecutor,
  getFirestoreCircuitExecutor,
} from '@services/firestore/FirestoreCircuitExecutor';
import { VideoJobRecordSchema } from './schemas';
import type { DlqEntry, VideoJobError, VideoJobRecord, VideoJobRequest } from './types';
import { resolveProviderForModel } from '../providers/ProviderRegistry';
import type { VideoModelId } from '../types';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PROVIDER = 'unknown';
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

function resolveProviderFromRequest(request: VideoJobRequest): string {
  const model = request.options?.model;
  if (typeof model === 'string' && model.length > 0) {
    try {
      return resolveProviderForModel(model as VideoModelId);
    } catch {
      return DEFAULT_PROVIDER;
    }
  }
  return DEFAULT_PROVIDER;
}

export class VideoJobStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('video_jobs');
  private readonly deadLetterCollection = this.db.collection('video_job_dlq');
  private readonly log = logger.child({ service: 'VideoJobStore' });
  private readonly firestoreCircuitExecutor: FirestoreCircuitExecutor;
  private readonly defaultMaxAttempts: number;

  constructor(
    firestoreCircuitExecutor: FirestoreCircuitExecutor = getFirestoreCircuitExecutor(),
    defaultMaxAttempts: number = DEFAULT_MAX_ATTEMPTS
  ) {
    this.firestoreCircuitExecutor = firestoreCircuitExecutor;
    this.defaultMaxAttempts = defaultMaxAttempts;
  }

  private async withTiming<T>(operation: string, mode: 'read' | 'write', fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      if (mode === 'write') {
        return await this.firestoreCircuitExecutor.executeWrite(`videoJobStore.${operation}`, fn);
      }
      return await this.firestoreCircuitExecutor.executeRead(`videoJobStore.${operation}`, fn);
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
    const maxAttempts = resolvePositiveInt(input.maxAttempts, this.defaultMaxAttempts);
    const provider = resolveProviderFromRequest(input.request);

    const record = {
      status: 'queued',
      userId: input.userId,
      request: input.request,
      creditsReserved: input.creditsReserved,
      provider,
      attempts: 0,
      maxAttempts,
      createdAtMs: now,
      updatedAtMs: now,
    };

    await this.withTiming('createJob', 'write', async () => {
      await docRef.set({
        ...record,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return this.parseJob(docRef.id, record);
  }

  async getJob(jobId: string): Promise<VideoJobRecord | null> {
    const snapshot = await this.withTiming('getJob', 'read', async () => await this.collection.doc(jobId).get());
    if (!snapshot.exists) {
      return null;
    }
    return this.parseJob(snapshot.id, snapshot.data());
  }

  async findJobByAssetId(assetId: string): Promise<VideoJobRecord | null> {
    const snapshot = await this.withTiming('findJobByAssetId', 'read', async () =>
      await this.collection.where('result.assetId', '==', assetId).limit(1).get()
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

  async claimNextJob(workerId: string, leaseMs: number, provider?: string): Promise<VideoJobRecord | null> {
    let queuedQuery: Query = this.collection.where('status', '==', 'queued');
    if (provider) {
      queuedQuery = queuedQuery.where('provider', '==', provider);
    }
    queuedQuery = queuedQuery.orderBy('createdAtMs', 'asc').limit(1);

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
    try {
      return await this.withTiming('claimJob', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
            this.defaultMaxAttempts
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
      );
    } catch (error) {
      logger.error('Failed to claim video job by id', error as Error, { jobId, workerId });
      return null;
    }
  }

  async renewLease(jobId: string, workerId: string, leaseMs: number): Promise<boolean> {
    try {
      return await this.withTiming('renewLease', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
      );
    } catch (error) {
      logger.error('Failed to renew video job lease', error as Error, { jobId, workerId });
      return false;
    }
  }

  async releaseClaim(jobId: string, workerId: string, reason: string): Promise<boolean> {
    try {
      return await this.withTiming('releaseClaim', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
      );
    } catch (error) {
      logger.error('Failed to release claimed video job', error as Error, { jobId, workerId, reason });
      return false;
    }
  }

  async requeueForRetry(jobId: string, workerId: string, error: VideoJobError): Promise<boolean> {
    const normalizedError = toVideoJobError(error);
    try {
      return await this.withTiming('requeueForRetry', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
      );
    } catch (txError) {
      logger.error('Failed to requeue video job for retry', txError as Error, { jobId, workerId });
      return false;
    }
  }

  async markCompleted(jobId: string, result: VideoJobRecord['result']): Promise<boolean> {
    const now = Date.now();

    try {
      return await this.withTiming('markCompleted', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
      );
    } catch (error) {
      logger.error('Failed to mark video job completed', error as Error, { jobId });
      return false;
    }
  }

  async markFailed(jobId: string, error: VideoJobErrorInput): Promise<boolean> {
    const now = Date.now();
    const normalizedError = toVideoJobError(error);

    try {
      return await this.withTiming('markFailed', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
      );
    } catch (txError) {
      logger.error('Failed to mark video job failed', txError as Error, { jobId });
      return false;
    }
  }

  async enqueueDeadLetter(
    job: VideoJobRecord,
    error: VideoJobError,
    source: DeadLetterSource
  ): Promise<void> {
    const now = Date.now();
    const normalizedError = toVideoJobError(error);
    const isRetryable = normalizedError.retryable !== false;
    const initialBackoffMs = 30_000;
    const maxDlqAttempts = 3;

    await this.withTiming('enqueueDeadLetter', 'write', async () => {
      await this.deadLetterCollection.doc(job.id).set(
        {
          jobId: job.id,
          userId: job.userId,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          request: job.request,
          creditsReserved: job.creditsReserved,
          provider: job.provider ?? 'unknown',
          error: normalizedError,
          source,
          dlqStatus: isRetryable ? 'pending' : 'escalated',
          dlqAttempt: 0,
          maxDlqAttempts,
          nextRetryAtMs: isRetryable ? now + initialBackoffMs : 0,
          lastDlqError: null,
          createdAtMs: now,
          updatedAtMs: now,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  async claimNextDlqEntry(nowMs: number): Promise<DlqEntry | null> {
    const query = this.deadLetterCollection
      .where('dlqStatus', '==', 'pending')
      .where('nextRetryAtMs', '<=', nowMs)
      .orderBy('nextRetryAtMs', 'asc')
      .limit(1);

    try {
      return await this.withTiming('claimNextDlqEntry', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(query);
          if (snapshot.empty) {
            return null;
          }

          const doc = snapshot.docs[0];
          if (!doc) {
            return null;
          }
          const data = doc.data();
          if (!data || data.dlqStatus !== 'pending') {
            return null;
          }

          const now = Date.now();
          transaction.update(doc.ref, {
            dlqStatus: 'processing',
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return {
            id: doc.id,
            jobId: data.jobId as string,
            userId: data.userId as string,
            request: data.request as VideoJobRequest,
            creditsReserved: typeof data.creditsReserved === 'number' ? data.creditsReserved : 0,
            provider: typeof data.provider === 'string' ? data.provider : 'unknown',
            error: data.error as VideoJobError,
            source: data.source as DeadLetterSource,
            dlqAttempt: typeof data.dlqAttempt === 'number' ? data.dlqAttempt : 0,
            maxDlqAttempts: typeof data.maxDlqAttempts === 'number' ? data.maxDlqAttempts : 3,
          } satisfies DlqEntry;
        })
      );
    } catch (error) {
      this.log.error('Failed to claim DLQ entry', error as Error);
      return null;
    }
  }

  async markDlqReprocessed(dlqId: string): Promise<void> {
    const now = Date.now();
    await this.withTiming('markDlqReprocessed', 'write', async () => {
      await this.deadLetterCollection.doc(dlqId).update({
        dlqStatus: 'reprocessed',
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  async markDlqFailed(dlqId: string, attempt: number, maxAttempts: number, errorMessage: string): Promise<void> {
    const now = Date.now();
    const escalate = attempt + 1 >= maxAttempts;
    const backoffMs = Math.min(300_000, 30_000 * Math.pow(2, attempt));

    await this.withTiming('markDlqFailed', 'write', async () => {
      await this.deadLetterCollection.doc(dlqId).update({
        dlqStatus: escalate ? 'escalated' : 'pending',
        dlqAttempt: attempt + 1,
        nextRetryAtMs: escalate ? 0 : now + backoffMs,
        lastDlqError: errorMessage,
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  async getDlqBacklogCount(): Promise<number> {
    const snapshot = await this.withTiming('getDlqBacklogCount', 'read', async () =>
      await this.deadLetterCollection.where('dlqStatus', '==', 'pending').count().get()
    );
    return snapshot.data().count;
  }

  private async claimFromQuery(query: Query, workerId: string, leaseMs: number): Promise<VideoJobRecord | null> {
    try {
      return await this.withTiming('claimFromQuery', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
            this.defaultMaxAttempts
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
      );
    } catch (error) {
      logger.error('Failed to claim video job', error as Error);
      return null;
    }
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
      ...(typeof parsed.provider === 'string' ? { provider: parsed.provider } : {}),
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      maxAttempts: resolvePositiveInt(
        typeof parsed.maxAttempts === 'number' ? parsed.maxAttempts : undefined,
        this.defaultMaxAttempts
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
    try {
      return await this.withTiming('failFromQuery', 'write', async () =>
        await this.db.runTransaction(async (transaction) => {
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
      );
    } catch (txError) {
      logger.error('Failed to mark stale video job failed', txError as Error, {
        reason: normalizedError.message,
        code: normalizedError.code,
      });
      return null;
    }
  }
}
