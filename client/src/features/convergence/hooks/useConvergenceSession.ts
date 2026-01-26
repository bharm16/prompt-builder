/**
 * useConvergenceSession Hook
 *
 * State management for the Visual Convergence flow using useReducer pattern.
 * Manages all convergence state including session lifecycle, dimension selection,
 * camera motion, subject motion, and navigation.
 *
 * Requirements:
 * - 9.1: Manage all convergence state using useReducer pattern
 * - 9.2-9.8: Track loading status, errors, session state, and image history
 * - 10.5: Support request cancellation via AbortController
 * - 12.5-12.6: Support keyboard navigation with focus tracking
 * - 13.1-13.7: Support back navigation and image restoration
 */

import { useReducer } from 'react';

import type { UseConvergenceSessionReturn } from './useConvergenceSession.types';

import { useConvergenceSessionActions } from './useConvergenceSession.actions';
import { convergenceReducer } from './useConvergenceSession.reducer';
import { initialState } from './useConvergenceSession.state';

export { convergenceReducer } from './useConvergenceSession.reducer';
export { initialState } from './useConvergenceSession.state';
export type {
  ConvergenceState,
  ConvergenceAction,
  ConvergenceActions,
  UseConvergenceSessionReturn,
} from './useConvergenceSession.types';

// ============================================================================
// Hook Implementation (Task 17.4)
// ============================================================================

/**
 * useConvergenceSession Hook
 *
 * Manages all convergence flow state using useReducer pattern.
 * Provides state and action creators for the convergence flow.
 *
 * @returns Object containing state and actions
 *
 * @example
 * ```tsx
 * function ConvergenceFlow() {
 *   const { state, actions } = useConvergenceSession();
 *
 *   const handleStart = async () => {
 *     await actions.startSession('A cat walking in the rain');
 *   };
 *
 *   return (
 *     <div>
 *       {state.step === 'intent' && (
 *         <IntentInput onSubmit={handleStart} />
 *       )}
 *       {state.step === 'direction' && (
 *         <DirectionFork
 *           images={state.currentImages}
 *           onSelect={(id) => actions.selectOption('direction', id)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useConvergenceSession(): UseConvergenceSessionReturn {
  const [state, dispatch] = useReducer(convergenceReducer, initialState);
  const actions = useConvergenceSessionActions(state, dispatch);

  return { state, actions };
}

export default useConvergenceSession;
