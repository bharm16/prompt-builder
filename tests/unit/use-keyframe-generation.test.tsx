import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useKeyframeGeneration } from '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/hooks/useKeyframeGeneration';
import type { Asset } from '@shared/types/asset';

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useKeyframeGeneration', () => {
  const character = { id: 'char-1', trigger: '@hero' } as Asset;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('error handling', () => {
    it('sets an error when the request fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false });
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() =>
        useKeyframeGeneration({ prompt: 'Prompt', characterAsset: character, aspectRatio: '16:9' })
      );

      await act(async () => {
        await result.current.generateKeyframes();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to generate keyframes');
        expect(result.current.keyframes).toEqual([]);
        expect(result.current.isGenerating).toBe(false);
      });
    });

    it('surfaces network errors from fetch', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() =>
        useKeyframeGeneration({ prompt: 'Prompt', characterAsset: character, aspectRatio: '16:9' })
      );

      await act(async () => {
        await result.current.generateKeyframes();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });
  });

  describe('edge cases', () => {
    it('clears state when prompt is empty', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() =>
        useKeyframeGeneration({ prompt: '   ', characterAsset: character, aspectRatio: '16:9' })
      );

      await act(async () => {
        await result.current.generateKeyframes();
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.keyframes).toEqual([]);
      expect(result.current.selectedKeyframe).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('ignores stale responses when a newer request finishes first', async () => {
      const first = createDeferred<Response>();
      const second = createDeferred<Response>();
      const fetchMock = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() =>
        useKeyframeGeneration({ prompt: 'Prompt', characterAsset: character, aspectRatio: '16:9' })
      );

      act(() => {
        void result.current.generateKeyframes();
      });
      act(() => {
        void result.current.generateKeyframes();
      });

      second.resolve({
        ok: true,
        json: async () => [{ imageUrl: 'latest', faceStrength: 0.8 }],
      } as Response);

      await waitFor(() => {
        expect(result.current.keyframes).toHaveLength(1);
        expect(result.current.keyframes[0]?.imageUrl).toBe('latest');
      });

      first.resolve({
        ok: true,
        json: async () => [{ imageUrl: 'stale', faceStrength: 0.3 }],
      } as Response);

      await waitFor(() => {
        expect(result.current.keyframes[0]?.imageUrl).toBe('latest');
      });
    });
  });

  describe('core behavior', () => {
    it('stores returned keyframe options on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ imageUrl: 'frame-1', faceStrength: 0.9 }],
      });
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() =>
        useKeyframeGeneration({ prompt: 'Prompt', characterAsset: character, aspectRatio: '16:9' })
      );

      await act(async () => {
        await result.current.generateKeyframes();
      });

      await waitFor(() => {
        expect(result.current.keyframes).toHaveLength(1);
        expect(result.current.keyframes[0]?.imageUrl).toBe('frame-1');
        expect(result.current.error).toBeNull();
      });
    });
  });
});
