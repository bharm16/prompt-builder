import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';

export type BillingProfileRecord = {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeLivemode?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

export class BillingProfileStore {
  private readonly db = getFirestore();
  private readonly collection = this.db.collection('billing_profiles');

  async getProfile(userId: string): Promise<BillingProfileRecord | null> {
    const snapshot = await this.collection.doc(userId).get();
    if (!snapshot.exists) return null;
    return snapshot.data() as BillingProfileRecord;
  }

  async upsertProfile(userId: string, update: Partial<BillingProfileRecord>): Promise<void> {
    const now = Date.now();
    const docRef = this.collection.doc(userId);

    try {
      await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);

        if (!snapshot.exists) {
          transaction.set(docRef, {
            createdAtMs: now,
            updatedAtMs: now,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...update,
          });
          return;
        }

        transaction.set(
          docRef,
          {
            ...update,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (error) {
      logger.error('Failed to upsert billing profile', error as Error, {
        userId,
        hasCustomerId: Boolean(update.stripeCustomerId),
        hasSubscriptionId: Boolean(update.stripeSubscriptionId),
      });
      throw error;
    }
  }
}

