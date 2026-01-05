import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';

export class UserCreditService {
  private db = getFirestore();
  private collection = this.db.collection('users');

  /**
   * Checks if a user has enough credits and reserves them in a transaction.
   * Deducts immediately to prevent double-spending during long-running generations.
   */
  async reserveCredits(userId: string, cost: number): Promise<boolean> {
    const userRef = this.collection.doc(userId);

    try {
      return await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(userRef);

        if (!snapshot.exists) {
          transaction.set(userRef, {
            credits: 100,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return true;
        }

        const data = snapshot.data();
        const currentCredits = data?.credits ?? 0;

        if (currentCredits < cost) {
          return false;
        }

        transaction.update(userRef, {
          credits: admin.firestore.FieldValue.increment(-cost),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return true;
      });
    } catch (error) {
      logger.error('Credit reservation failed', error as Error, { userId, cost });
      throw new Error('Failed to process credit transaction');
    }
  }

  /**
   * Refund credits when a generation fails.
   */
  async refundCredits(userId: string, cost: number): Promise<void> {
    try {
      await this.collection.doc(userId).update({
        credits: admin.firestore.FieldValue.increment(cost),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error('Credit refund failed', error as Error, { userId, cost });
    }
  }

  async getBalance(userId: string): Promise<number> {
    const snapshot = await this.collection.doc(userId).get();
    return snapshot.data()?.credits ?? 0;
  }

  /**
   * Adds credits to a user's balance in a transaction-safe way.
   * Creates the user document if it does not exist.
   */
  async addCredits(userId: string, amount: number): Promise<void> {
    const userRef = this.collection.doc(userId);

    try {
      await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(userRef);

        if (!snapshot.exists) {
          transaction.set(userRef, {
            credits: amount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        transaction.update(userRef, {
          credits: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      logger.info('Credits added successfully', { userId, amount });
    } catch (error) {
      logger.error('Failed to add credits', error as Error, { userId, amount });
      throw new Error('Transaction failed');
    }
  }
}

export const userCreditService = new UserCreditService();
