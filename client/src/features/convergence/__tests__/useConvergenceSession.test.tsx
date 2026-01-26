import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useConvergenceSession } from '../hooks/useConvergenceSession';
import { convergenceApi } from '../api/convergenceApi';
import { handleApiError } from '../hooks/useConvergenceSession.errorHandler';

vi.mock('../api/convergenceApi', () => ({
  convergenceApi: {
    startSession: vi.fn(),
  },
}));

vi.mock('../hooks/useConvergenceSession.errorHandler', () => ({
  handleApiError: vi.fn(),
}));

const mockApi = vi.mocked(convergenceApi);

// ============================================================================
// useConvergenceSession
// ============================================================================

describe('useConvergenceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('captures start session errors and allows clearing them', async () => {
      mockApi.startSession.mockRejectedValueOnce(new Error('Start failed'));

      const { result } = renderHook(() => useConvergenceSession());

      await act(async () => {
        await result.current.actions.startSession('A prompt');
      });

      expect(result.current.state.error).toBe('Start failed');
      expect(handleApiError).toHaveBeenCalled();

      act(() => {
        result.current.actions.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('initializes with the intent step and empty intent', () => {
      const { result } = renderHook(() => useConvergenceSession());

      expect(result.current.state.step).toBe('intent');
      expect(result.current.state.intent).toBe('');
    });
  });

  describe('core behavior', () => {
    it('updates intent through the exposed actions', () => {
      const { result } = renderHook(() => useConvergenceSession());

      act(() => {
        result.current.actions.setIntent('A new idea');
      });

      expect(result.current.state.intent).toBe('A new idea');
    });
  });
});
