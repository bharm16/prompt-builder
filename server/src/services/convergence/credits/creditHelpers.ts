/**
 * Credit Helper Functions for Visual Convergence
 *
 * Provides utility functions for credit management including the
 * withCreditReservation wrapper pattern and checkCredits helper.
 *
 * Requirements:
 * - 15.5: If user has insufficient credits, block generation and prompt to purchase
 * - 15.6: Reserve credits at request time and refund automatically on failure
 */

import { ConvergenceError } from '../errors';
import type { CreditsService } from './CreditsService';

/**
 * Wrapper function that implements the credit reservation pattern.
 *
 * This pattern ensures atomic credit operations:
 * 1. Reserve credits before the operation
 * 2. Execute the operation
 * 3. Commit credits on success OR refund on failure
 *
 * Usage in ConvergenceService:
 * ```typescript
 * const images = await withCreditReservation(
 *   this.creditsService,
 *   userId,
 *   estimatedCost,
 *   async () => {
 *     return this.generateAndPersistImages(prompts, userId);
 *   }
 * );
 * ```
 *
 * @param creditsService - The CreditsService instance to use
 * @param userId - Firebase Auth UID
 * @param creditAmount - Number of credits to reserve
 * @param operation - Async operation to execute
 * @returns Result of the operation
 * @throws ConvergenceError('INSUFFICIENT_CREDITS') if balance < creditAmount
 * @throws Any error from the operation (credits are refunded)
 */
export async function withCreditReservation<T>(
  creditsService: CreditsService,
  userId: string,
  creditAmount: number,
  operation: () => Promise<T>
): Promise<T> {
  // Reserve credits before the operation
  const reservation = await creditsService.reserve(userId, creditAmount);

  try {
    // Execute the operation
    const result = await operation();

    // Commit the reservation on success
    await creditsService.commit(reservation.id);

    return result;
  } catch (error) {
    // Refund the reservation on failure
    await creditsService.refund(reservation.id);

    throw error;
  }
}

/**
 * Helper function to check if a user has sufficient credits before an operation.
 *
 * Use this for pre-flight checks before starting expensive operations,
 * or when you want to show the user their balance vs required credits.
 *
 * Note: This is a point-in-time check. For actual credit deduction,
 * use withCreditReservation() which handles race conditions.
 *
 * @param creditsService - The CreditsService instance to use
 * @param userId - Firebase Auth UID
 * @param required - Number of credits required
 * @throws ConvergenceError('INSUFFICIENT_CREDITS') if balance < required
 */
export async function checkCredits(
  creditsService: CreditsService,
  userId: string,
  required: number
): Promise<void> {
  const balance = await creditsService.getBalance(userId);

  if (balance < required) {
    throw new ConvergenceError('INSUFFICIENT_CREDITS', {
      required,
      available: balance,
    });
  }
}

/**
 * Get the user's current credit balance.
 *
 * Convenience wrapper around creditsService.getBalance() for use in
 * components that need to display the balance.
 *
 * @param creditsService - The CreditsService instance to use
 * @param userId - Firebase Auth UID
 * @returns Current credit balance
 */
export async function getCreditBalance(
  creditsService: CreditsService,
  userId: string
): Promise<number> {
  return creditsService.getBalance(userId);
}
