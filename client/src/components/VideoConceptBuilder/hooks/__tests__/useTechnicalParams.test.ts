import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch } from 'react';

import { useTechnicalParams } from '../useTechnicalParams';
import type { VideoConceptAction, Elements } from '../types';
import { VideoConceptApi } from '../../api/videoConceptApi';

vi.mock('../../api/videoConceptApi', () => ({
  VideoConceptApi: {
    generateTechnicalParams: vi.fn(),
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

describe('useTechnicalParams', () => {
  const mockGenerateTechnicalParams = vi.mocked(VideoConceptApi.generateTechnicalParams);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('returns empty object and clears state when API rejects', async () => {
      mockGenerateTechnicalParams.mockRejectedValueOnce(new Error('boom'));
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;

      const { result } = renderHook(() => useTechnicalParams(dispatch));
      let resolved: Record<string, unknown> | null = null;

      await act(async () => {
        resolved = await result.current({
          subject: 'cat',
          action: 'jumping',
          location: 'garden',
        } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'TECHNICAL_PARAMS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({ type: 'TECHNICAL_PARAMS_CLEAR' });
      expect(resolved).toEqual({});
      expect(loggerMocks.error).toHaveBeenCalled();
    });

    it('ignores stale responses when newer request starts', async () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const first = createDeferred<Record<string, unknown>>();
      const second = createDeferred<Record<string, unknown>>();
      mockGenerateTechnicalParams
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const dateNowSpy = vi.spyOn(Date, 'now');
      dateNowSpy.mockReturnValueOnce(10).mockReturnValueOnce(20);

      const { result } = renderHook(() => useTechnicalParams(dispatch));

      act(() => {
        void result.current({ subject: 'cat', action: 'jumping', location: 'roof' } as Elements);
        void result.current({ subject: 'cat', action: 'jumping', location: 'roof' } as Elements);
      });

      await act(async () => {
        first.resolve({ camera: 'old' });
        await first.promise;
      });

      expect(dispatch).not.toHaveBeenCalledWith({
        type: 'TECHNICAL_PARAMS_LOADED',
        payload: { camera: 'old' },
      });

      await act(async () => {
        second.resolve({ camera: 'new' });
        await second.promise;
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'TECHNICAL_PARAMS_LOADED',
        payload: { camera: 'new' },
      });

      dateNowSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('returns null and clears state when fewer than three elements are filled', async () => {
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const { result } = renderHook(() => useTechnicalParams(dispatch));
      let resolved: Record<string, unknown> | null = undefined;

      await act(async () => {
        resolved = await result.current({ subject: 'cat', action: '' } as Elements);
      });

      expect(mockGenerateTechnicalParams).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({ type: 'TECHNICAL_PARAMS_CLEAR' });
      expect(resolved).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('loads technical params and returns the data on success', async () => {
      mockGenerateTechnicalParams.mockResolvedValueOnce({ lighting: 'soft' });
      const dispatch = vi.fn() as Dispatch<VideoConceptAction>;
      const { result } = renderHook(() => useTechnicalParams(dispatch));
      let resolved: Record<string, unknown> | null = null;

      await act(async () => {
        resolved = await result.current({
          subject: 'cat',
          action: 'jumping',
          location: 'garden',
        } as Elements);
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'TECHNICAL_PARAMS_LOADING' });
      expect(dispatch).toHaveBeenCalledWith({
        type: 'TECHNICAL_PARAMS_LOADED',
        payload: { lighting: 'soft' },
      });
      expect(resolved).toEqual({ lighting: 'soft' });
    });
  });
});
