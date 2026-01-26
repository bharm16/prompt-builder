import { describe, it, expect } from 'vitest';

import { initialState } from '../hooks/useConvergenceSession.state';

// ============================================================================
// useConvergenceSession.state
// ============================================================================

describe('initialState', () => {
  describe('error handling', () => {
    it('initializes map-based caches as empty maps', () => {
      expect(initialState.regenerationCounts).toBeInstanceOf(Map);
      expect(initialState.imageHistory).toBeInstanceOf(Map);
      expect(initialState.regenerationCounts.size).toBe(0);
      expect(initialState.imageHistory.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('starts without an active session or selected options', () => {
      expect(initialState.sessionId).toBeNull();
      expect(initialState.direction).toBeNull();
      expect(initialState.startingPointMode).toBeNull();
      expect(initialState.currentImages).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('defaults to the intent step with idle loading state', () => {
      expect(initialState.step).toBe('intent');
      expect(initialState.isLoading).toBe(false);
      expect(initialState.loadingOperation).toBeNull();
      expect(initialState.focusedOptionIndex).toBe(0);
    });
  });
});
