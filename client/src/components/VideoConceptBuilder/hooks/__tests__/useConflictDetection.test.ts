import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch } from 'react';

import { useConflictDetection } from '../useConflictDetection';
import type { VideoConceptAction, Elements } from '../types';
import { VideoConceptApi } from '../../api/videoConceptApi';

vi.mock('../../api/videoConceptApi', () => ({
  VideoConceptApi: {
    validateElements: vi.fn(),
  },
}));

const loggerMocks = vi.hoisted(() => ({
  startTimer: vi.fn(),
  endTimer: vi.fn(() => 18),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: loggerMocks,
}));

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

describe('useConflictDetection', () => {
  const mockValidateElements = vi.mocked(VideoConceptApi.validateElements);
  const composedElements = { subject: 'cat', action: 'jumping' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('clears conflicts and logs when API rejects', async () => {
      mockValidateElements.mockRejectedValueOnce(new Error('boom'));
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useConflictDetection(dispatch, composedElements));

      await act(async () => {
        await result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'CONFLICTS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({ type: 'CONFLICTS_CLEAR' });
      expect(loggerMocks.error).toHaveBeenCalled();
    });

    it('ignores stale responses from earlier requests', async () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const first = createDeferred<{ conflicts: string[] }>();
      const second = createDeferred<{ conflicts: string[] }>();

      mockValidateElements
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValueOnce(100).mockReturnValueOnce(200);

      const { result } = renderHook(() => useConflictDetection(dispatch, composedElements));

      act(() => {
        void result.current({ subject: 'cat', action: 'jumping' } as Elements);
        void result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      await act(async () => {
        first.resolve({ conflicts: ['old'] });
        await first.promise;
      });

      expect(dispatch).not.toHaveBeenCalledWith({
        type: 'CONFLICTS_LOADED',
        payload: [{ message: 'old' }],
      });

      await act(async () => {
        second.resolve({ conflicts: ['new'] });
        await second.promise;
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'CONFLICTS_LOADED',
        payload: [{ message: 'new' }],
      });

      dateNowSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('clears conflicts without API call when fewer than two elements are filled', async () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const { result } = renderHook(() => useConflictDetection(dispatch, composedElements));

      await act(async () => {
        await result.current({ subject: 'cat', action: '' } as Elements);
      });

      expect(mockValidateElements).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({ type: 'CONFLICTS_CLEAR' });
    });

    it('handles non-array conflicts payloads by dispatching empty list', async () => {
      mockValidateElements.mockResolvedValueOnce({ conflicts: null } as never);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useConflictDetection(dispatch, composedElements));

      await act(async () => {
        await result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'CONFLICTS_LOADED',
        payload: [],
      });
    });
  });

  describe('core behavior', () => {
    it('dispatches mapped conflicts after successful validation', async () => {
      mockValidateElements.mockResolvedValueOnce({ conflicts: ['Issue A', 'Issue B'] } as never);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useConflictDetection(dispatch, composedElements));

      await act(async () => {
        await result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'CONFLICTS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({
        type: 'CONFLICTS_LOADED',
        payload: [{ message: 'Issue A' }, { message: 'Issue B' }],
      });
    });
  });
});
