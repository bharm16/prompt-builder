import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch } from 'react';

import { useRefinements } from '../useRefinements';
import type { VideoConceptAction, Elements } from '../types';
import { VideoConceptApi } from '../../api/videoConceptApi';

vi.mock('../../api/videoConceptApi', () => ({
  VideoConceptApi: {
    fetchRefinements: vi.fn(),
  },
}));

const loggerMocks = vi.hoisted(() => ({
  startTimer: vi.fn(),
  endTimer: vi.fn(() => 12),
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

describe('useRefinements', () => {
  const mockFetchRefinements = vi.mocked(VideoConceptApi.fetchRefinements);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('clears refinements and logs when API rejects', async () => {
      mockFetchRefinements.mockRejectedValueOnce(new Error('boom'));
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useRefinements(dispatch));

      await act(async () => {
        await result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'REFINEMENTS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({ type: 'REFINEMENTS_CLEAR' });
      expect(loggerMocks.error).toHaveBeenCalled();
    });

    it('ignores stale responses when newer request starts', async () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const first = createDeferred<Record<string, string[]>>();
      const second = createDeferred<Record<string, string[]>>();
      mockFetchRefinements
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValueOnce(111).mockReturnValueOnce(222);

      const { result } = renderHook(() => useRefinements(dispatch));

      act(() => {
        void result.current({ subject: 'cat', action: 'jumping' } as Elements);
        void result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      await act(async () => {
        first.resolve({ action: ['old'] });
        await first.promise;
      });

      expect(dispatch).not.toHaveBeenCalledWith({
        type: 'REFINEMENTS_LOADED',
        payload: { action: ['old'] },
      });

      await act(async () => {
        second.resolve({ action: ['new'] });
        await second.promise;
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'REFINEMENTS_LOADED',
        payload: { action: ['new'] },
      });

      dateNowSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('clears refinements without API call when fewer than two elements are filled', async () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const { result } = renderHook(() => useRefinements(dispatch));

      await act(async () => {
        await result.current({ subject: 'cat', action: '' } as Elements);
      });

      expect(mockFetchRefinements).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({ type: 'REFINEMENTS_CLEAR' });
    });
  });

  describe('core behavior', () => {
    it('dispatches refinement data when API succeeds', async () => {
      mockFetchRefinements.mockResolvedValueOnce({ subject: ['detailed'] });
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useRefinements(dispatch));

      await act(async () => {
        await result.current({ subject: 'cat', action: 'jumping' } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'REFINEMENTS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({
        type: 'REFINEMENTS_LOADED',
        payload: { subject: ['detailed'] },
      });
    });
  });
});
