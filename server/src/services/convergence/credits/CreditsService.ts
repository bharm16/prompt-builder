/**
 * CreditsService Interface and Implementation
 *
 * Provides credit management for the Visual Convergence feature with a reservation pattern.
 * Credits are reserved before operations and either committed on success or refunded on failure.
 *
 * Requirements:
 * - 15.5: If user has insufficient credits, block generation and prompt to purchase
 * - 15.6: Reserve credits at request time and refund automatically on failure
 * - 15.7: When user goes back and selects different option, charge credits for newly generated images
 * - 15.8: When user goes back and selects same option (restoring cached images), do NOT charge credits
 */

import { v4 as uuidv4 } from 'uuid';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import { ConvergenceError } from '../errors';
import type { CreditReservation, CreditReservationStatus } from '../types';

// ============================================================================
// Interface Definition
// ============================================================================

/**
 * Service interface for managing user credits with reservation pattern.
 *
 * The reservation pattern ensures atomic credit operations:
 * 1. reserve() - Holds credits (deducts from balance, creates pending reservation)
 * 2. commit() - Finalizes the deduction (marks reservation as committed)
 * 3. refund() - Returns credits on failure (adds back to balance, marks as refunded)
 */
export interface CreditsService {
  /**
   * Get current credit balance for user
   * @param userId - Firebase Auth UID
   * @returns Current credit balance
   */
  getBalance(userId: string): Promise<number>;

  /**
   * Reserve credits for an operation (holds but doesn't permanently deduct)
   * Credits are deducted immediately to prevent double-spending, but can be refunded on failure.
   *
   * @param userId - Firebase Auth UID
   * @param amount - Number of credits to reserve
   * @returns CreditReservation object with pending status
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if balance < amount
   */
  reserve(userId: string, amount: number): Promise<CreditReservation>;

  /**
   * Commit a reservation (marks the deduction as final)
   * @param reservationId - ID of the reservation to commit
   */
  commit(reservationId: string): Promise<void>;

  /**
   * Refund a reservation (releases hold and returns credits to user)
   * @param reservationId - ID of the reservation to refund
   */
  refund(reservationId: string): Promise<void>;

  /**
   * Direct debit for committed operations (no reservation needed)
   * Use for operations that don't need the reservation pattern.
   *
   * @param userId - Firebase Auth UID
   * @param amount - Number of credits to debit
   * @param reason - Description of why credits are being debited
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if balance < amount
   */
  debit(userId: string, amount: number, reason: string): Promise<void>;
}

// ============================================================================
// Firestore Implementation
// ============================================================================

/**
 * Firestore-backed implementation of CreditsService.
 *
 * Uses two collections:
 * - users: Stores user credit balances
 * - credit_reservations: Stores reservation records for audit trail
 */
export class FirestoreCreditsService implements CreditsService {
  private db = getFirestore();
  private usersCollection = this.db.collection('users');
  private reservationsCollection = this.db.collection('credit_reservations');

  /**
   * Get current credit balance for user
   */
  async getBalance(userId: string): Promise<number> {
    const snapshot = await this.usersCollection.doc(userId).get();
    const data = snapshot.data();
    return data?.credits ?? 0;
  }

  /**
   * Reserve credits for an operation.
   *
   * Implementation:
   * 1. Check if user has sufficient balance
   * 2. Deduct credits immediately (prevents double-spending)
   * 3. Create a pending reservation record
   * 4. Return the reservation for later commit/refund
   */
  async reserve(userId: string, amount: number): Promise<CreditReservation> {
    const userRef = this.usersCollection.doc(userId);
    const reservationId = uuidv4();
    const createdAt = new Date();

    try {
      await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(userRef);

        if (!snapshot.exists) {
          throw new ConvergenceError('INSUFFICIENT_CREDITS', {
            required: amount,
            available: 0,
          });
        }

        const data = snapshot.data();
        const currentCredits = data?.credits ?? 0;

        if (currentCredits < amount) {
          throw new ConvergenceError('INSUFFICIENT_CREDITS', {
            required: amount,
            available: currentCredits,
          });
        }

        // Deduct credits immediately to prevent double-spending
        transaction.update(userRef, {
          credits: admin.firestore.FieldValue.increment(-amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create reservation record
        const reservationRef = this.reservationsCollection.doc(reservationId);
        transaction.set(reservationRef, {
          id: reservationId,
          userId,
          amount,
          status: 'pending' as CreditReservationStatus,
          createdAt: admin.firestore.Timestamp.fromDate(createdAt),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      logger.info('Credits reserved', { userId, amount, reservationId });

      return {
        id: reservationId,
        userId,
        amount,
        createdAt,
        status: 'pending',
      };
    } catch (error) {
      if (error instanceof ConvergenceError) {
        throw error;
      }
      logger.error('Credit reservation failed', error as Error, { userId, amount });
      throw new Error('Failed to reserve credits');
    }
  }

  /**
   * Commit a reservation (marks the deduction as final).
   *
   * Since credits were already deducted during reserve(), this just updates
   * the reservation status to 'committed' for audit purposes.
   */
  async commit(reservationId: string): Promise<void> {
    try {
      const reservationRef = this.reservationsCollection.doc(reservationId);
      const snapshot = await reservationRef.get();

      if (!snapshot.exists) {
        logger.warn('Attempted to commit non-existent reservation', { reservationId });
        return;
      }

      const data = snapshot.data();
      if (data?.status !== 'pending') {
        logger.warn('Attempted to commit non-pending reservation', {
          reservationId,
          currentStatus: data?.status,
        });
        return;
      }

      await reservationRef.update({
        status: 'committed' as CreditReservationStatus,
        committedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info('Credit reservation committed', { reservationId });
    } catch (error) {
      logger.error('Failed to commit credit reservation', error as Error, { reservationId });
      // Don't throw - credits are already deducted, this is just bookkeeping
    }
  }

  /**
   * Refund a reservation (returns credits to user).
   *
   * Adds the reserved amount back to the user's balance and marks
   * the reservation as 'refunded'.
   */
  async refund(reservationId: string): Promise<void> {
    try {
      await this.db.runTransaction(async (transaction) => {
        const reservationRef = this.reservationsCollection.doc(reservationId);
        const snapshot = await transaction.get(reservationRef);

        if (!snapshot.exists) {
          logger.warn('Attempted to refund non-existent reservation', { reservationId });
          return;
        }

        const data = snapshot.data();
        if (data?.status !== 'pending') {
          logger.warn('Attempted to refund non-pending reservation', {
            reservationId,
            currentStatus: data?.status,
          });
          return;
        }

        const { userId, amount } = data;

        // Return credits to user
        const userRef = this.usersCollection.doc(userId);
        transaction.update(userRef, {
          credits: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Mark reservation as refunded
        transaction.update(reservationRef, {
          status: 'refunded' as CreditReservationStatus,
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      logger.info('Credit reservation refunded', { reservationId });
    } catch (error) {
      logger.error('Failed to refund credit reservation', error as Error, { reservationId });
      // This is critical - we should retry or alert
      throw new Error('Failed to refund credits');
    }
  }

  /**
   * Direct debit for committed operations (no reservation needed).
   *
   * Use this for simple operations that don't need the full reservation pattern.
   */
  async debit(userId: string, amount: number, reason: string): Promise<void> {
    const userRef = this.usersCollection.doc(userId);

    try {
      await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(userRef);

        if (!snapshot.exists) {
          throw new ConvergenceError('INSUFFICIENT_CREDITS', {
            required: amount,
            available: 0,
          });
        }

        const data = snapshot.data();
        const currentCredits = data?.credits ?? 0;

        if (currentCredits < amount) {
          throw new ConvergenceError('INSUFFICIENT_CREDITS', {
            required: amount,
            available: currentCredits,
          });
        }

        transaction.update(userRef, {
          credits: admin.firestore.FieldValue.increment(-amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log the debit for audit purposes
        const debitRef = this.db.collection('credit_debits').doc();
        transaction.set(debitRef, {
          userId,
          amount,
          reason,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      logger.info('Credits debited', { userId, amount, reason });
    } catch (error) {
      if (error instanceof ConvergenceError) {
        throw error;
      }
      logger.error('Credit debit failed', error as Error, { userId, amount, reason });
      throw new Error('Failed to debit credits');
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let creditsServiceInstance: CreditsService | null = null;

/**
 * Get the singleton CreditsService instance.
 * Creates a new FirestoreCreditsService if one doesn't exist.
 */
export function getCreditsService(): CreditsService {
  if (!creditsServiceInstance) {
    creditsServiceInstance = new FirestoreCreditsService();
  }
  return creditsServiceInstance;
}

/**
 * Set a custom CreditsService instance (useful for testing).
 */
export function setCreditsService(service: CreditsService): void {
  creditsServiceInstance = service;
}
