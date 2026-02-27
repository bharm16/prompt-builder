import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import {
  FirestoreCircuitExecutor,
  getFirestoreCircuitExecutor,
} from '@services/firestore/FirestoreCircuitExecutor';

type UnresolvedPaymentEventStatus = 'open' | 'resolved';
type BillingProfileRepairStatus = 'pending' | 'processing' | 'resolved' | 'escalated';

interface UnresolvedPaymentEventRecord {
  status: UnresolvedPaymentEventStatus;
  eventType: string;
  reason: string;
  livemode: boolean;
  occurrenceCount: number;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
  stripeObjectId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface BillingProfileRepairRecord {
  status: BillingProfileRepairStatus;
  source: 'checkout' | 'invoice';
  userId: string;
  stripeCustomerId: string;
  stripeLivemode: boolean;
  stripeSubscriptionId?: string;
  planTier?: string;
  subscriptionPriceId?: string;
  eventId?: string;
  referenceId: string;
  attempts: number;
  lastError?: string;
  createdAtMs: number;
  updatedAtMs: number;
  processingStartedAtMs?: number;
  resolvedAtMs?: number;
  escalatedAtMs?: number;
}

export interface RecordUnresolvedPaymentEventInput {
  eventId: string;
  eventType: string;
  reason: string;
  livemode: boolean;
  stripeObjectId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface UnresolvedPaymentSummary {
  openCount: number;
  oldestOpenAgeMs: number | null;
}

export interface EnqueueBillingProfileRepairInput {
  repairKey: string;
  source: 'checkout' | 'invoice';
  userId: string;
  stripeCustomerId: string;
  stripeLivemode: boolean;
  stripeSubscriptionId?: string;
  planTier?: string;
  subscriptionPriceId?: string;
  eventId?: string;
  referenceId: string;
}

export interface BillingProfileRepairTask {
  repairKey: string;
  source: 'checkout' | 'invoice';
  userId: string;
  stripeCustomerId: string;
  stripeLivemode: boolean;
  stripeSubscriptionId?: string;
  planTier?: string;
  subscriptionPriceId?: string;
  eventId?: string;
  referenceId: string;
  attempts: number;
}

export class PaymentConsistencyStore {
  private readonly db = getFirestore();
  private readonly unresolvedEventsCollection = this.db.collection('payment_unresolved_events');
  private readonly billingProfileRepairCollection = this.db.collection('billing_profile_repairs');
  private readonly firestoreCircuitExecutor: FirestoreCircuitExecutor;

  constructor(firestoreCircuitExecutor: FirestoreCircuitExecutor = getFirestoreCircuitExecutor()) {
    this.firestoreCircuitExecutor = firestoreCircuitExecutor;
  }

  async recordUnresolvedEvent(input: RecordUnresolvedPaymentEventInput): Promise<void> {
    const now = Date.now();
    const docRef = this.unresolvedEventsCollection.doc(input.eventId);

    await this.firestoreCircuitExecutor.executeWrite(
      'payment.consistency.recordUnresolvedEvent',
      async () =>
        await this.db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(docRef);
          const nextDocument = {
            eventType: input.eventType,
            reason: input.reason,
            livemode: input.livemode,
            ...(input.stripeObjectId ? { stripeObjectId: input.stripeObjectId } : {}),
            ...(input.userId ? { userId: input.userId } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
            status: 'open' as const,
            lastSeenAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          if (!snapshot.exists) {
            transaction.set(docRef, {
              ...nextDocument,
              firstSeenAtMs: now,
              occurrenceCount: 1,
              createdAtMs: now,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          const existing = snapshot.data() as UnresolvedPaymentEventRecord | undefined;
          const nextCount =
            typeof existing?.occurrenceCount === 'number' && Number.isFinite(existing.occurrenceCount)
              ? existing.occurrenceCount + 1
              : 1;

          transaction.update(docRef, {
            ...nextDocument,
            occurrenceCount: nextCount,
            firstSeenAtMs:
              typeof existing?.firstSeenAtMs === 'number' && Number.isFinite(existing.firstSeenAtMs)
                ? existing.firstSeenAtMs
                : now,
          });
        })
    );
  }

  async getUnresolvedSummary(): Promise<UnresolvedPaymentSummary> {
    try {
      const snapshot = await this.firestoreCircuitExecutor.executeRead(
        'payment.consistency.getUnresolvedSummary',
        async () => await this.unresolvedEventsCollection.where('status', '==', 'open').get()
      );

      if (snapshot.empty) {
        return {
          openCount: 0,
          oldestOpenAgeMs: null,
        };
      }

      let oldestFirstSeenAtMs = Number.POSITIVE_INFINITY;
      const now = Date.now();

      for (const doc of snapshot.docs) {
        const data = doc.data() as UnresolvedPaymentEventRecord;
        if (typeof data.firstSeenAtMs === 'number' && Number.isFinite(data.firstSeenAtMs)) {
          oldestFirstSeenAtMs = Math.min(oldestFirstSeenAtMs, data.firstSeenAtMs);
        }
      }

      return {
        openCount: snapshot.size,
        oldestOpenAgeMs:
          oldestFirstSeenAtMs === Number.POSITIVE_INFINITY ? null : Math.max(0, now - oldestFirstSeenAtMs),
      };
    } catch (error) {
      logger.warn('Failed to read unresolved payment summary', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        openCount: 0,
        oldestOpenAgeMs: null,
      };
    }
  }

  async enqueueBillingProfileRepair(input: EnqueueBillingProfileRepairInput): Promise<void> {
    const now = Date.now();
    const docRef = this.billingProfileRepairCollection.doc(input.repairKey);

    await this.firestoreCircuitExecutor.executeWrite(
      'payment.consistency.enqueueBillingProfileRepair',
      async () =>
        await this.db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(docRef);
          const nextDocument = {
            source: input.source,
            userId: input.userId,
            stripeCustomerId: input.stripeCustomerId,
            stripeLivemode: input.stripeLivemode,
            ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
            ...(input.planTier ? { planTier: input.planTier } : {}),
            ...(input.subscriptionPriceId ? { subscriptionPriceId: input.subscriptionPriceId } : {}),
            ...(input.eventId ? { eventId: input.eventId } : {}),
            referenceId: input.referenceId,
            status: 'pending' as const,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          if (!snapshot.exists) {
            transaction.set(docRef, {
              ...nextDocument,
              attempts: 0,
              createdAtMs: now,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          const existing = snapshot.data() as BillingProfileRepairRecord | undefined;
          if (existing?.status === 'resolved') {
            return;
          }

          transaction.update(docRef, {
            ...nextDocument,
            lastError: admin.firestore.FieldValue.delete(),
            processingStartedAtMs: admin.firestore.FieldValue.delete(),
          });
        })
    );
  }

  async claimNextBillingProfileRepair(
    maxAttempts: number,
    scanLimit: number
  ): Promise<BillingProfileRepairTask | null> {
    try {
      const snapshot = await this.firestoreCircuitExecutor.executeRead(
        'payment.consistency.claimBillingProfileRepair.queryPending',
        async () => await this.billingProfileRepairCollection.where('status', '==', 'pending').limit(scanLimit).get()
      );
      if (snapshot.empty) {
        return null;
      }

      const docs = snapshot.docs
        .map((doc) => ({ id: doc.id, data: doc.data() as BillingProfileRepairRecord }))
        .sort((a, b) => {
          const aTs = Number(a.data.updatedAtMs ?? 0);
          const bTs = Number(b.data.updatedAtMs ?? 0);
          return aTs - bTs;
        });

      for (const doc of docs) {
        const claimed = await this.firestoreCircuitExecutor.executeWrite(
          'payment.consistency.claimBillingProfileRepair.transaction',
          async () =>
            await this.db.runTransaction(async (transaction) => {
              const docRef = this.billingProfileRepairCollection.doc(doc.id);
              const fresh = await transaction.get(docRef);
              if (!fresh.exists) {
                return null;
              }

              const data = fresh.data() as BillingProfileRepairRecord | undefined;
              if (!data || data.status !== 'pending') {
                return null;
              }

              const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
              if (attempts >= maxAttempts) {
                const now = Date.now();
                transaction.update(docRef, {
                  status: 'escalated' as BillingProfileRepairStatus,
                  escalatedAtMs: now,
                  updatedAtMs: now,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                return null;
              }

              const now = Date.now();
              transaction.update(docRef, {
                status: 'processing' as BillingProfileRepairStatus,
                processingStartedAtMs: now,
                updatedAtMs: now,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              return this.toBillingProfileRepairTask(doc.id, {
                ...data,
                status: 'processing',
                processingStartedAtMs: now,
                updatedAtMs: now,
              });
            })
        );

        if (claimed) {
          return claimed;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to claim billing profile repair task', error as Error, {
        maxAttempts,
        scanLimit,
      });
      return null;
    }
  }

  async markBillingProfileRepairResolved(repairKey: string): Promise<void> {
    const now = Date.now();
    await this.firestoreCircuitExecutor.executeWrite(
      'payment.consistency.markBillingProfileRepairResolved',
      async () =>
        await this.billingProfileRepairCollection.doc(repairKey).set(
          {
            status: 'resolved' as BillingProfileRepairStatus,
            resolvedAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
    );
  }

  async releaseBillingProfileRepairForRetry(repairKey: string, lastError: string): Promise<void> {
    const now = Date.now();
    await this.firestoreCircuitExecutor.executeWrite(
      'payment.consistency.releaseBillingProfileRepairForRetry',
      async () =>
        await this.db.runTransaction(async (transaction) => {
          const docRef = this.billingProfileRepairCollection.doc(repairKey);
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) {
            return;
          }

          const data = snapshot.data() as BillingProfileRepairRecord | undefined;
          if (!data) {
            return;
          }

          const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
          transaction.update(docRef, {
            status: 'pending' as BillingProfileRepairStatus,
            attempts: attempts + 1,
            lastError,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        })
    );
  }

  async markBillingProfileRepairEscalated(repairKey: string, lastError: string): Promise<void> {
    const now = Date.now();
    await this.firestoreCircuitExecutor.executeWrite(
      'payment.consistency.markBillingProfileRepairEscalated',
      async () =>
        await this.db.runTransaction(async (transaction) => {
          const docRef = this.billingProfileRepairCollection.doc(repairKey);
          const snapshot = await transaction.get(docRef);
          if (!snapshot.exists) {
            return;
          }

          const data = snapshot.data() as BillingProfileRepairRecord | undefined;
          if (!data) {
            return;
          }

          const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
          transaction.update(docRef, {
            status: 'escalated' as BillingProfileRepairStatus,
            attempts: attempts + 1,
            lastError,
            escalatedAtMs: now,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        })
    );
  }

  private toBillingProfileRepairTask(
    repairKey: string,
    data: BillingProfileRepairRecord
  ): BillingProfileRepairTask {
    return {
      repairKey,
      source: data.source,
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId,
      stripeLivemode: data.stripeLivemode,
      referenceId: data.referenceId,
      attempts: typeof data.attempts === 'number' ? data.attempts : 0,
      ...(data.stripeSubscriptionId ? { stripeSubscriptionId: data.stripeSubscriptionId } : {}),
      ...(data.planTier ? { planTier: data.planTier } : {}),
      ...(data.subscriptionPriceId ? { subscriptionPriceId: data.subscriptionPriceId } : {}),
      ...(data.eventId ? { eventId: data.eventId } : {}),
    };
  }
}
