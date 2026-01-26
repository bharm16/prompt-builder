import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch } from 'react';

import { useCompatibilityScores } from '../useCompatibilityScores';
import type { VideoConceptAction, ElementKey } from '../types';
import { VideoConceptApi } from '../../api/videoConceptApi';

vi.mock('../../api/videoConceptApi', () => ({
  VideoConceptApi: {
    checkCompatibility: vi.fn(),
  },
}));

const loggerMocks = vi.hoisted(() => ({
  startTimer: vi.fn(),
  endTimer: vi.fn(() => 42),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: loggerMocks,
}));

describe('useCompatibilityScores', () => {
  const mockCheckCompatibility = vi.mocked(VideoConceptApi.checkCompatibility);
  const composedElements = { subject: 'cat', action: 'jumping' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('dispatches fallback score and logs when API rejects', async () => {
      mockCheckCompatibility.mockRejectedValueOnce(new Error('boom'));
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useCompatibilityScores(dispatch, composedElements));

      act(() => {
        result.current('subject', 'cat');
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_COMPATIBILITY_SCORE',
        payload: { key: 'subject', score: 0.5 },
      });
      expect(loggerMocks.error).toHaveBeenCalled();
    });

    it('dispatches fallback score when API throws synchronously', async () => {
      mockCheckCompatibility.mockImplementationOnce(() => {
        throw new Error('sync-fail');
      });
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useCompatibilityScores(dispatch, composedElements));

      act(() => {
        result.current('action', 'jumping');
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_COMPATIBILITY_SCORE',
        payload: { key: 'action', score: 0.5 },
      });
    });
  });

  describe('edge cases', () => {
    it('returns score 1 without calling API when value is empty', () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const { result } = renderHook(() => useCompatibilityScores(dispatch, composedElements));

      act(() => {
        result.current('subject', '');
      });

      expect(mockCheckCompatibility).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_COMPATIBILITY_SCORE',
        payload: { key: 'subject', score: 1 },
      });
    });

    it('debounces rapid updates for the same element key', async () => {
      mockCheckCompatibility.mockResolvedValueOnce(0.82);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const { result } = renderHook(() => useCompatibilityScores(dispatch, composedElements));

      act(() => {
        result.current('subject', 'first');
        result.current('subject', 'second');
      });

      expect(mockCheckCompatibility).not.toHaveBeenCalled();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckCompatibility).toHaveBeenCalledTimes(1);
      expect(mockCheckCompatibility).toHaveBeenCalledWith('subject', 'second', composedElements);
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_COMPATIBILITY_SCORE',
        payload: { key: 'subject', score: 0.82 },
      });
    });
  });

  describe('core behavior', () => {
    it('uses override elements when provided and dispatches resolved score', async () => {
      mockCheckCompatibility.mockResolvedValueOnce(0.9);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const override = { subject: 'dog', action: 'running' };

      const { result } = renderHook(() => useCompatibilityScores(dispatch, composedElements));

      act(() => {
        result.current('subject', 'dog', override as Record<string, string>);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckCompatibility).toHaveBeenCalledWith('subject', 'dog', override);
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_COMPATIBILITY_SCORE',
        payload: { key: 'subject', score: 0.9 },
      });
    });

    it('clears pending timers on unmount', () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const { result, unmount } = renderHook(() => useCompatibilityScores(dispatch, composedElements));

      act(() => {
        result.current('action', 'jumping');
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
