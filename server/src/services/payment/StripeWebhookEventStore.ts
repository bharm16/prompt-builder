import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';

const DEFAULT_PROCESSING_TTL_MS = 10 * 60 * 1000;

type StripeWebhookStatus = 'processing' | 'processed' | 'failed';

interface StripeWebhookEventRecord {
  status: StripeWebhookStatus;
  type: string;
  livemode: boolean;
  attempt: number;
  createdAtMs: number;
  updatedAtMs: number;
  lastError?: string;
}

export type StripeWebhookClaimResult =
  | { state: 'claimed' }
  | { state: 'processed' }
  | { state: 'in_progress' };

export class StripeWebhookEventStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('stripe_webhook_events');
  private readonly processingTtlMs: number;

  constructor(processingTtlMs = DEFAULT_PROCESSING_TTL_MS) {
    this.processingTtlMs = processingTtlMs;
  }

  async claimEvent(
    eventId: string,
    metadata: { type: string; livemode: boolean }
  ): Promise<StripeWebhookClaimResult> {
    const now = Date.now();

    return await this.db.runTransaction(async (transaction) => {
      const docRef = this.collection.doc(eventId);
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists) {
        transaction.set(docRef, {
          status: 'processing',
          type: metadata.type,
          livemode: metadata.livemode,
          attempt: 1,
          createdAtMs: now,
          updatedAtMs: now,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { state: 'claimed' };
      }

      const existing = snapshot.data() as StripeWebhookEventRecord | undefined;
      if (existing?.status === 'processed') {
        return { state: 'processed' };
      }

      if (existing?.status === 'processing') {
        const isStale =
          typeof existing.updatedAtMs === 'number' && now - existing.updatedAtMs > this.processingTtlMs;
        if (!isStale) {
          return { state: 'in_progress' };
        }
      }

      transaction.update(docRef, {
        status: 'processing',
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        attempt: (existing?.attempt ?? 0) + 1,
        lastError: admin.firestore.FieldValue.delete(),
      });

      return { state: 'claimed' };
    });
  }

  async markProcessed(eventId: string): Promise<void> {
    const now = Date.now();
    await this.collection.doc(eventId).set(
      {
        status: 'processed',
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  async markFailed(eventId: string, error: Error): Promise<void> {
    const now = Date.now();
    try {
      await this.collection.doc(eventId).set(
        {
          status: 'failed',
          updatedAtMs: now,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastError: error.message,
        },
        { merge: true }
      );
    } catch (storeError) {
      logger.error('Failed to record Stripe webhook failure', storeError as Error, {
        eventId,
      });
    }
  }
}
