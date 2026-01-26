import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useAsyncScheduler } from '@features/span-highlighting/hooks/useAsyncScheduler';
import type { SpanLabelingPayload } from '@features/span-highlighting/hooks/types';

vi.mock('@features/span-highlighting/utils/spanLabelingScheduler', () => ({
  calculateEffectiveDebounce: (_payload: unknown, options: { debounceMs: number; immediate: boolean }) =>
    options.immediate || options.debounceMs === 0 ? 0 : options.debounceMs,
}));

const createDeferred = () => {
  let resolve: (value: unknown) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise((res, rej) => {
    resolve = res as (value: unknown) => void;
    reject = rej as (error: Error) => void;
  });
  return { promise, resolve, reject };
};

describe('useAsyncScheduler', () => {
  const payload: SpanLabelingPayload = { text: 'hello world' };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('skips execution when disabled', () => {
      const onExecute = vi.fn();
      const onLoadingState = vi.fn();

      const { result } = renderHook(() =>
        useAsyncScheduler(
          { enabled: false, debounceMs: 0, useSmartDebounce: false, immediate: false },
          { onExecute, onLoadingState }
        )
      );

      act(() => {
        result.current.schedule(payload);
      });

      expect(onExecute).not.toHaveBeenCalled();
      expect(onLoadingState).not.toHaveBeenCalled();
    });

    it('prevents stale requests from emitting success results', async () => {
      const first = createDeferred();
      const second = createDeferred();
      let firstSignal: AbortSignal | null = null;

      const onExecute = vi
        .fn()
        .mockImplementationOnce((_: SpanLabelingPayload, signal: AbortSignal) => {
          firstSignal = signal;
          return first.promise;
        })
        .mockImplementationOnce(() => second.promise);

      const results: string[] = [];
      const { result } = renderHook(() =>
        useAsyncScheduler(
          { enabled: true, debounceMs: 0, useSmartDebounce: false, immediate: false },
          {
            onExecute,
            onSuccess: (value) => {
              results.push(String(value));
            },
          }
        )
      );

      act(() => {
        result.current.schedule(payload);
      });

      act(() => {
        result.current.schedule({ text: 'next' });
      });

      expect(firstSignal?.aborted).toBe(true);

      first.resolve('first');
      await act(async () => {
        await Promise.resolve();
      });

      expect(results).toEqual([]);

      second.resolve('second');
      await act(async () => {
        await Promise.resolve();
      });

      expect(results).toEqual(['second']);
    });

    it('forwards execution errors to the error callback', async () => {
      const onError = vi.fn();
      const onExecute = vi.fn().mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() =>
        useAsyncScheduler(
          { enabled: true, debounceMs: 0, useSmartDebounce: false, immediate: false },
          { onExecute, onError }
        )
      );

      act(() => {
        result.current.schedule(payload);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), payload);
    });
  });

  describe('edge cases', () => {
    it('debounces execution before calling the async task', async () => {
      const onExecute = vi.fn().mockResolvedValue('ok');
      const onLoadingState = vi.fn();

      const { result } = renderHook(() =>
        useAsyncScheduler(
          { enabled: true, debounceMs: 50, useSmartDebounce: false, immediate: false },
          { onExecute, onLoadingState }
        )
      );

      act(() => {
        result.current.schedule(payload);
      });

      expect(onLoadingState).toHaveBeenCalledWith(false);
      expect(onExecute).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(49);
      });

      expect(onExecute).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(onExecute).toHaveBeenCalledWith(payload, expect.any(AbortSignal));
    });
  });

  describe('core behavior', () => {
    it('executes immediately when debounce is zero', async () => {
      const onExecute = vi.fn().mockResolvedValue({ ok: true });
      const results: Array<unknown> = [];

      const { result } = renderHook(() =>
        useAsyncScheduler(
          { enabled: true, debounceMs: 0, useSmartDebounce: false, immediate: false },
          {
            onExecute,
            onSuccess: (value) => {
              results.push(value);
            },
          }
        )
      );

      act(() => {
        result.current.schedule(payload);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(results).toEqual([{ ok: true }]);
    });
  });
});
