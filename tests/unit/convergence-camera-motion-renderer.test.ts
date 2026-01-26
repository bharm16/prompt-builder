import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';

import {
  createFrameAnimator,
  createCleanupFunction,
  easeInOutCubic,
} from '@features/convergence/utils/cameraMotionRenderer';

type RafCallback = FrameRequestCallback;

describe('cameraMotionRenderer', () => {
  let requestAnimationFrameMock: MockedFunction<typeof requestAnimationFrame>;
  let cancelAnimationFrameMock: MockedFunction<typeof cancelAnimationFrame>;
  let rafCallbacks: Map<number, RafCallback>;
  let originalRequestAnimationFrame: typeof requestAnimationFrame | undefined;
  let originalCancelAnimationFrame: typeof cancelAnimationFrame | undefined;

  const runAnimationFrame = (callIndex: number, timestamp: number) => {
    const id = requestAnimationFrameMock.mock.results[callIndex]?.value;
    if (typeof id !== 'number') {
      throw new Error('Expected requestAnimationFrame to return a numeric id');
    }

    const callback = rafCallbacks.get(id);
    if (!callback) {
      throw new Error(`Missing callback for requestAnimationFrame id ${id}`);
    }

    rafCallbacks.delete(id);
    callback(timestamp);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = new Map();

    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    requestAnimationFrameMock = vi.fn((callback: RafCallback) => {
      const id = rafCallbacks.size + 1;
      rafCallbacks.set(id, callback);
      return id;
    });

    cancelAnimationFrameMock = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });

    const globalWithRaf = globalThis as typeof globalThis & {
      requestAnimationFrame?: typeof requestAnimationFrame;
      cancelAnimationFrame?: typeof cancelAnimationFrame;
    };

    globalWithRaf.requestAnimationFrame = requestAnimationFrameMock as unknown as typeof requestAnimationFrame;
    globalWithRaf.cancelAnimationFrame = cancelAnimationFrameMock as unknown as typeof cancelAnimationFrame;
  });

  afterEach(() => {
    const globalWithRaf = globalThis as typeof globalThis & {
      requestAnimationFrame?: typeof requestAnimationFrame;
      cancelAnimationFrame?: typeof cancelAnimationFrame;
    };

    if (originalRequestAnimationFrame) {
      globalWithRaf.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete globalWithRaf.requestAnimationFrame;
    }

    if (originalCancelAnimationFrame) {
      globalWithRaf.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete globalWithRaf.cancelAnimationFrame;
    }

    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('does not start when frames are empty', () => {
      const onFrame = vi.fn();
      const animator = createFrameAnimator([], 15, onFrame);

      animator.start();

      expect(onFrame).not.toHaveBeenCalled();
      expect(requestAnimationFrameMock).not.toHaveBeenCalled();
      expect(animator.isPlaying()).toBe(false);
    });

    it('ignores start when already playing', () => {
      const onFrame = vi.fn();
      vi.spyOn(performance, 'now').mockReturnValue(0);

      const animator = createFrameAnimator(['frame-a', 'frame-b'], 12, onFrame);

      animator.start();
      animator.start();

      expect(onFrame).toHaveBeenCalledTimes(1);
      expect(onFrame).toHaveBeenCalledWith('frame-a');
      expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
      expect(animator.isPlaying()).toBe(true);
    });

    it('stops animation and ignores pending callbacks', () => {
      const onFrame = vi.fn();
      vi.spyOn(performance, 'now').mockReturnValue(0);

      const animator = createFrameAnimator(['frame-a', 'frame-b'], 10, onFrame);

      animator.start();

      const firstId = requestAnimationFrameMock.mock.results[0]?.value;
      if (typeof firstId !== 'number') {
        throw new Error('Expected requestAnimationFrame to return a numeric id');
      }

      const scheduledCallback = rafCallbacks.get(firstId);
      if (!scheduledCallback) {
        throw new Error('Expected a scheduled requestAnimationFrame callback');
      }

      animator.stop();

      expect(cancelAnimationFrameMock).toHaveBeenCalledWith(firstId);
      const callCount = onFrame.mock.calls.length;

      scheduledCallback(1000);

      expect(onFrame).toHaveBeenCalledTimes(callCount);
      expect(animator.isPlaying()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns expected cubic ease boundaries', () => {
      expect(easeInOutCubic(0)).toBe(0);
      expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
      expect(easeInOutCubic(1)).toBe(1);
    });

    it('disposes resources via cleanup function', () => {
      const geometry = { dispose: vi.fn() };
      const material = { dispose: vi.fn() };
      const imageTexture = { dispose: vi.fn() };
      const depthTexture = { dispose: vi.fn() };
      const renderer = { dispose: vi.fn() };
      const scene = { remove: vi.fn(), clear: vi.fn() };
      const mesh = { name: 'mesh' };

      const resources = {
        scene,
        camera: {},
        renderer,
        geometry,
        material,
        mesh,
        imageTexture,
        depthTexture,
      } as unknown as Parameters<typeof createCleanupFunction>[0];

      const cleanup = createCleanupFunction(resources);

      cleanup();

      expect(geometry.dispose).toHaveBeenCalledTimes(1);
      expect(material.dispose).toHaveBeenCalledTimes(1);
      expect(imageTexture.dispose).toHaveBeenCalledTimes(1);
      expect(depthTexture.dispose).toHaveBeenCalledTimes(1);
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      expect(scene.remove).toHaveBeenCalledWith(mesh);
      expect(scene.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('core behavior', () => {
    it('advances frames on elapsed time and loops', () => {
      const onFrame = vi.fn();
      vi.spyOn(performance, 'now').mockReturnValue(0);

      const animator = createFrameAnimator(['frame-a', 'frame-b'], 2, onFrame);

      animator.start();

      runAnimationFrame(0, 500);
      runAnimationFrame(1, 1000);
      runAnimationFrame(2, 1500);

      expect(onFrame.mock.calls.map(call => call[0])).toEqual([
        'frame-a',
        'frame-a',
        'frame-b',
        'frame-a',
      ]);
    });
  });
});
