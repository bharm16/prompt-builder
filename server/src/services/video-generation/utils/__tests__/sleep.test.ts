import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep } from '../sleep';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('core behavior', () => {
    it('resolves after specified milliseconds', async () => {
      const promise = sleep(1000);
      let resolved = false;
      promise.then(() => { resolved = true; });

      // Not yet resolved
      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);

      // Now resolved
      await vi.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);
    });

    it('resolves to undefined', async () => {
      const promise = sleep(0);
      await vi.advanceTimersByTimeAsync(0);
      const result = await promise;
      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('resolves immediately for 0ms delay', async () => {
      const promise = sleep(0);
      await vi.advanceTimersByTimeAsync(0);
      await expect(promise).resolves.toBeUndefined();
    });

    it('returns a Promise', () => {
      const result = sleep(100);
      expect(result).toBeInstanceOf(Promise);
      vi.advanceTimersByTime(100);
    });
  });
});
