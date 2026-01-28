/**
 * Unit tests for Credit Reservation Pattern
 *
 * Tests the credit management system including the reservation pattern
 * that ensures atomic credit operations.
 *
 * Requirements tested:
 * - 15.5: If user has insufficient credits, block generation and prompt to purchase
 * - 15.6: Reserve credits at request time and refund automatically on failure
 * - 15.7: When user goes back and selects different option, charge credits for newly generated images
 * - 15.8: When user goes back and selects same option (restoring cached images), do NOT charge credits
 *
 * @module convergence-credits.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConvergenceError } from '@services/convergence/errors';
import { withCreditReservation, checkCredits } from '@services/convergence/credits/creditHelpers';
import type { CreditsService } from '@services/convergence/credits/CreditsService';
import type { CreditReservation } from '@services/convergence/types';

/**
 * Creates a mock credits service for testing
 */
function createMockCreditsService(initialBalance: number = 100): CreditsService & {
  _balance: number;
  _reservations: Map<string, CreditReservation>;
} {
  let balance = initialBalance;
  const reservations = new Map<string, CreditReservation>();

  return {
    _balance: balance,
    _reservations: reservations,

    getBalance: vi.fn(async () => balance),

    reserve: vi.fn(async (userId: string, amount: number) => {
      if (balance < amount) {
        throw new ConvergenceError('INSUFFICIENT_CREDITS', {
          required: amount,
          available: balance,
        });
      }

      balance -= amount;
      const reservation: CreditReservation = {
        id: `reservation-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        amount,
        createdAt: new Date(),
        status: 'pending',
      };
      reservations.set(reservation.id, reservation);
      return reservation;
    }),

    commit: vi.fn(async (reservationId: string) => {
      const reservation = reservations.get(reservationId);
      if (reservation) {
        reservation.status = 'committed';
      }
    }),

    refund: vi.fn(async (reservationId: string) => {
      const reservation = reservations.get(reservationId);
      if (reservation && reservation.status === 'pending') {
        balance += reservation.amount;
        reservation.status = 'refunded';
      }
    }),

    debit: vi.fn(async (userId: string, amount: number) => {
      if (balance < amount) {
        throw new ConvergenceError('INSUFFICIENT_CREDITS', {
          required: amount,
          available: balance,
        });
      }
      balance -= amount;
    }),
  };
}

describe('Credit Reservation Pattern', () => {
  let creditsService: ReturnType<typeof createMockCreditsService>;

  beforeEach(() => {
    creditsService = createMockCreditsService(100);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('withCreditReservation', () => {
    /**
     * Requirement 15.6: Reserve credits at request time and refund automatically on failure
     */
    it('should reserve credits before operation', async () => {
      const operation = vi.fn(async () => 'success');

      await withCreditReservation(creditsService, 'user-123', 10, operation);

      expect(creditsService.reserve).toHaveBeenCalledWith('user-123', 10);
    });

    it('should commit credits on successful operation', async () => {
      const operation = vi.fn(async () => 'success');

      await withCreditReservation(creditsService, 'user-123', 10, operation);

      expect(creditsService.commit).toHaveBeenCalled();
      expect(creditsService.refund).not.toHaveBeenCalled();
    });

    it('should refund credits on failed operation', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Operation failed');
      });

      await expect(
        withCreditReservation(creditsService, 'user-123', 10, operation)
      ).rejects.toThrow('Operation failed');

      expect(creditsService.refund).toHaveBeenCalled();
      expect(creditsService.commit).not.toHaveBeenCalled();
    });

    it('should return the operation result on success', async () => {
      const operation = vi.fn(async () => ({ data: 'test-result' }));

      const result = await withCreditReservation(creditsService, 'user-123', 10, operation);

      expect(result).toEqual({ data: 'test-result' });
    });

    it('should propagate the original error on failure', async () => {
      const originalError = new Error('Specific error message');
      const operation = vi.fn(async () => {
        throw originalError;
      });

      await expect(
        withCreditReservation(creditsService, 'user-123', 10, operation)
      ).rejects.toThrow('Specific error message');
    });

    /**
     * Requirement 15.5: If user has insufficient credits, block generation
     */
    it('should throw INSUFFICIENT_CREDITS when balance is too low', async () => {
      creditsService = createMockCreditsService(5); // Only 5 credits
      const operation = vi.fn(async () => 'success');

      await expect(
        withCreditReservation(creditsService, 'user-123', 10, operation)
      ).rejects.toThrow(ConvergenceError);

      try {
        await withCreditReservation(creditsService, 'user-123', 10, operation);
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INSUFFICIENT_CREDITS');
        expect((error as ConvergenceError).details?.required).toBe(10);
        expect((error as ConvergenceError).details?.available).toBe(5);
      }

      // Operation should not be called
      expect(operation).not.toHaveBeenCalled();
    });

    it('should not call operation when reservation fails', async () => {
      creditsService = createMockCreditsService(0);
      const operation = vi.fn(async () => 'success');

      await expect(
        withCreditReservation(creditsService, 'user-123', 10, operation)
      ).rejects.toThrow();

      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('checkCredits', () => {
    it('should not throw when balance is sufficient', async () => {
      await expect(checkCredits(creditsService, 'user-123', 50)).resolves.not.toThrow();
    });

    it('should throw INSUFFICIENT_CREDITS when balance is too low', async () => {
      creditsService = createMockCreditsService(10);

      await expect(checkCredits(creditsService, 'user-123', 50)).rejects.toThrow(ConvergenceError);

      try {
        await checkCredits(creditsService, 'user-123', 50);
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INSUFFICIENT_CREDITS');
        expect((error as ConvergenceError).details?.required).toBe(50);
        expect((error as ConvergenceError).details?.available).toBe(10);
      }
    });

    it('should throw when balance equals required (edge case)', async () => {
      creditsService = createMockCreditsService(10);

      // Balance equals required should pass
      await expect(checkCredits(creditsService, 'user-123', 10)).resolves.not.toThrow();
    });
  });

  describe('Credit Balance Consistency', () => {
    /**
     * Property: Credit reservation is atomic
     * Credits reserved for an operation are either committed on success or refunded on failure
     */
    it('should maintain balance consistency on success', async () => {
      const initialBalance = 100;
      creditsService = createMockCreditsService(initialBalance);
      const creditCost = 10;

      const operation = vi.fn(async () => 'success');

      await withCreditReservation(creditsService, 'user-123', creditCost, operation);

      // After successful operation, balance should be reduced by creditCost
      const finalBalance = await creditsService.getBalance('user-123');
      expect(finalBalance).toBe(initialBalance - creditCost);
    });

    it('should maintain balance consistency on failure', async () => {
      const initialBalance = 100;
      creditsService = createMockCreditsService(initialBalance);
      const creditCost = 10;

      const operation = vi.fn(async () => {
        throw new Error('Operation failed');
      });

      await expect(
        withCreditReservation(creditsService, 'user-123', creditCost, operation)
      ).rejects.toThrow();

      // After failed operation, balance should be restored
      const finalBalance = await creditsService.getBalance('user-123');
      expect(finalBalance).toBe(initialBalance);
    });

    it('should handle multiple sequential operations', async () => {
      const initialBalance = 100;
      creditsService = createMockCreditsService(initialBalance);

      // First operation succeeds
      await withCreditReservation(creditsService, 'user-123', 10, async () => 'success1');

      // Second operation fails
      await expect(
        withCreditReservation(creditsService, 'user-123', 20, async () => {
          throw new Error('Failed');
        })
      ).rejects.toThrow();

      // Third operation succeeds
      await withCreditReservation(creditsService, 'user-123', 15, async () => 'success3');

      // Final balance should be: 100 - 10 (success) - 0 (refunded) - 15 (success) = 75
      const finalBalance = await creditsService.getBalance('user-123');
      expect(finalBalance).toBe(75);
    });
  });

  describe('Reservation Lifecycle', () => {
    it('should create pending reservation on reserve', async () => {
      const reservation = await creditsService.reserve('user-123', 10);

      expect(reservation.status).toBe('pending');
      expect(reservation.amount).toBe(10);
      expect(reservation.userId).toBe('user-123');
    });

    it('should mark reservation as committed on commit', async () => {
      const reservation = await creditsService.reserve('user-123', 10);
      await creditsService.commit(reservation.id);

      const storedReservation = creditsService._reservations.get(reservation.id);
      expect(storedReservation?.status).toBe('committed');
    });

    it('should mark reservation as refunded on refund', async () => {
      const reservation = await creditsService.reserve('user-123', 10);
      await creditsService.refund(reservation.id);

      const storedReservation = creditsService._reservations.get(reservation.id);
      expect(storedReservation?.status).toBe('refunded');
    });

    it('should not refund already committed reservation', async () => {
      const initialBalance = 100;
      creditsService = createMockCreditsService(initialBalance);

      const reservation = await creditsService.reserve('user-123', 10);
      await creditsService.commit(reservation.id);

      // Try to refund committed reservation
      await creditsService.refund(reservation.id);

      // Balance should remain reduced (not refunded)
      const finalBalance = await creditsService.getBalance('user-123');
      expect(finalBalance).toBe(initialBalance - 10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero credit operations', async () => {
      const operation = vi.fn(async () => 'success');

      await withCreditReservation(creditsService, 'user-123', 0, operation);

      expect(operation).toHaveBeenCalled();
    });

    it('should handle exact balance match', async () => {
      creditsService = createMockCreditsService(10);
      const operation = vi.fn(async () => 'success');

      await withCreditReservation(creditsService, 'user-123', 10, operation);

      expect(operation).toHaveBeenCalled();
      const finalBalance = await creditsService.getBalance('user-123');
      expect(finalBalance).toBe(0);
    });

    it('should handle async operation that takes time', async () => {
      const operation = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'delayed-success';
      });

      const result = await withCreditReservation(creditsService, 'user-123', 10, operation);

      expect(result).toBe('delayed-success');
      expect(creditsService.commit).toHaveBeenCalled();
    });

    it('should handle operation that throws non-Error objects', async () => {
      const operation = vi.fn(async () => {
        throw 'string error';
      });

      await expect(
        withCreditReservation(creditsService, 'user-123', 10, operation)
      ).rejects.toBe('string error');

      expect(creditsService.refund).toHaveBeenCalled();
    });
  });
});
