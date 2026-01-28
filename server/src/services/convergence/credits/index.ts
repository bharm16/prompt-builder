/**
 * Credits module for Visual Convergence
 *
 * Exports the CreditsService interface and implementation for managing
 * user credits with a reservation pattern.
 */

// Interface and implementation
export type { CreditsService } from './CreditsService';
export {
  FirestoreCreditsService,
  getCreditsService,
  setCreditsService,
} from './CreditsService';

// Helper functions
export {
  withCreditReservation,
  checkCredits,
  getCreditBalance,
} from './creditHelpers';
