import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch } from 'react';

import { useElementSuggestions } from '../useElementSuggestions';
import type { VideoConceptAction, ElementKey } from '../types';
import { VideoConceptApi } from '../../api/videoConceptApi';

vi.mock('../../api/videoConceptApi', () => ({
  VideoConceptApi: {
    fetchSuggestions: vi.fn(),
  },
}));

const loggerMocks = vi.hoisted(() => ({
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

describe('useElementSuggestions', () => {
  const mockFetchSuggestions = vi.mocked(VideoConceptApi.fetchSuggestions);
  const composedElements = { subject: 'cat', action: 'jumping', subjectDescriptors: '' } as Record<string, string>;
  const conflicts = [
    { message: 'Conflict A', resolution: 'Fix A', severity: 'high' },
    { message: 'Conflict B', suggestion: 'Fix B' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('clears suggestions and logs on non-abort errors', async () => {
      mockFetchSuggestions.mockRejectedValueOnce(new Error('boom'));
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() =>
        useElementSuggestions(dispatch, composedElements, 'concept', conflicts)
      );

      await act(async () => {
        await result.current.fetchSuggestions('subject' as ElementKey);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'SUGGESTIONS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ACTIVE_ELEMENT', payload: 'subject' });
      expect(dispatch).toHaveBeenCalledWith({ type: 'SUGGESTIONS_CLEAR' });
      expect(loggerMocks.error).toHaveBeenCalled();
    });

    it('suppresses clear when request is aborted', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      mockFetchSuggestions.mockRejectedValueOnce(abortError);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() =>
        useElementSuggestions(dispatch, composedElements, 'concept', conflicts)
      );

      await act(async () => {
        await result.current.fetchSuggestions('subject' as ElementKey);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'SUGGESTIONS_LOADING' });
      expect(dispatch).not.toHaveBeenCalledWith({ type: 'SUGGESTIONS_CLEAR' });
    });
  });

  describe('edge cases', () => {
    it('dedupes requests within cooldown window', async () => {
      mockFetchSuggestions.mockResolvedValue(['idea']);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1200);

      const { result } = renderHook(() =>
        useElementSuggestions(dispatch, composedElements, 'concept', [])
      );

      await act(async () => {
        await result.current.fetchSuggestions('subject' as ElementKey);
        await result.current.fetchSuggestions('subject' as ElementKey);
      });

      expect(mockFetchSuggestions).toHaveBeenCalledTimes(1);
      dateNowSpy.mockRestore();
    });

    it('blocks concurrent fetches while a request is in flight', async () => {
      const deferred = createDeferred<string[]>();
      mockFetchSuggestions.mockReturnValueOnce(deferred.promise);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() =>
        useElementSuggestions(dispatch, composedElements, 'concept', [])
      );

      act(() => {
        void result.current.fetchSuggestions('subject' as ElementKey);
      });

      await act(async () => {
        await result.current.fetchSuggestions('action' as ElementKey);
      });

      expect(mockFetchSuggestions).toHaveBeenCalledTimes(1);

      await act(async () => {
        deferred.resolve(['done']);
        await deferred.promise;
      });
    });
  });

  describe('core behavior', () => {
    it('dispatches loaded suggestions after successful fetch', async () => {
      mockFetchSuggestions.mockResolvedValueOnce(['idea 1', 'idea 2']);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() =>
        useElementSuggestions(dispatch, composedElements, 'concept', conflicts)
      );

      await act(async () => {
        await result.current.fetchSuggestions('subject' as ElementKey);
      });

      expect(mockFetchSuggestions).toHaveBeenCalledWith(
        'subject',
        'cat',
        expect.objectContaining({
          subject: 'cat',
          action: 'jumping',
          conflicts: [
            { message: 'Conflict A', resolution: 'Fix A', severity: 'high' },
            { message: 'Conflict B', resolution: 'Fix B', severity: null },
          ],
        }),
        'concept',
        expect.any(Object)
      );

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SUGGESTIONS_LOADED',
        payload: ['idea 1', 'idea 2'],
      });
    });

    it('clears suggestions and aborts in-flight requests when clearSuggestions is called', async () => {
      const abortSpy = vi.fn();
      const originalAbortController = globalThis.AbortController;
      globalThis.AbortController = vi.fn(() => ({ signal: {}, abort: abortSpy })) as unknown as typeof AbortController;

      mockFetchSuggestions.mockResolvedValueOnce(['idea']);
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() =>
        useElementSuggestions(dispatch, composedElements, 'concept', [])
      );

      await act(async () => {
        await result.current.fetchSuggestions('subject' as ElementKey);
      });

      act(() => {
        result.current.clearSuggestions();
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'SUGGESTIONS_CLEAR' });
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ACTIVE_ELEMENT', payload: null });
      expect(abortSpy).toHaveBeenCalled();

      globalThis.AbortController = originalAbortController;
    });
  });
});
