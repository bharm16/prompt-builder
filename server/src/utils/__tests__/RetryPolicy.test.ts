import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryPolicy } from '../RetryPolicy';

const { sleepMock } = vi.hoisted(() => ({
  sleepMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../sleep', () => ({
  sleep: sleepMock,
}));

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RetryPolicy.execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('throws immediately when shouldRetry returns false', async () => {
      const error = new Error('Do not retry');
      const fn = vi.fn().mockRejectedValue(error);
      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(RetryPolicy.execute(fn, { shouldRetry })).rejects.toThrow('Do not retry');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws last error after all retries exhausted', async () => {
      const error = new Error('Persistent failure');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(RetryPolicy.execute(fn, { maxRetries: 2 })).rejects.toThrow('Persistent failure');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('converts non-Error throws to Error objects', async () => {
      const fn = vi.fn().mockRejectedValue('string error');

      await expect(RetryPolicy.execute(fn, { maxRetries: 0 })).rejects.toThrow('string error');
    });

    it('handles thrown null gracefully', async () => {
      const fn = vi.fn().mockRejectedValue(null);

      await expect(RetryPolicy.execute(fn, { maxRetries: 0 })).rejects.toThrow('null');
    });

    it('handles thrown undefined gracefully', async () => {
      const fn = vi.fn().mockRejectedValue(undefined);

      await expect(RetryPolicy.execute(fn, { maxRetries: 0 })).rejects.toThrow('undefined');
    });
  });

  describe('edge cases', () => {
    it('uses default maxRetries of 2 when not specified', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(RetryPolicy.execute(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 default retries
    });

    it('handles maxRetries of 0 (no retries)', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(RetryPolicy.execute(fn, { maxRetries: 0 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('succeeds on last retry attempt', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const result = await RetryPolicy.execute(fn, { maxRetries: 2 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('respects shouldRetry on each attempt', async () => {
      const shouldRetry = vi.fn()
        .mockReturnValueOnce(true)  // Retry after first failure
        .mockReturnValueOnce(false); // Don't retry after second

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(RetryPolicy.execute(fn, { shouldRetry, maxRetries: 5 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('callbacks', () => {
    it('calls onRetry with error and attempt number', async () => {
      const onRetry = vi.fn();
      const error = new Error('retry error');
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      await RetryPolicy.execute(fn, { onRetry, maxRetries: 1 });

      expect(onRetry).toHaveBeenCalledWith(error, 1);
    });

    it('calls onRetry for each retry attempt', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(RetryPolicy.execute(fn, { onRetry, maxRetries: 2 })).rejects.toThrow();

      // With maxRetries=2, there are 3 attempts total (initial + 2 retries)
      // onRetry is called after each failed attempt before the break
      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
      expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 3);
    });

    it('does not call onRetry on first attempt or on success', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockResolvedValue('success');

      await RetryPolicy.execute(fn, { onRetry });

      expect(onRetry).not.toHaveBeenCalled();
    });

    it('waits fixed delay between retries when delayMs is set', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('retry me'))
        .mockResolvedValueOnce('ok');

      const result = await RetryPolicy.execute(fn, { maxRetries: 1, delayMs: 250 });

      expect(result).toBe('ok');
      expect(sleepMock).toHaveBeenCalledWith(250);
    });

    it('uses dynamic delay function for exponential-style backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockRejectedValueOnce(new Error('fail-2'))
        .mockResolvedValueOnce('ok');
      const getDelayMs = vi.fn((attempt: number) => 100 * attempt);

      const result = await RetryPolicy.execute(fn, {
        maxRetries: 2,
        getDelayMs,
      });

      expect(result).toBe('ok');
      expect(getDelayMs).toHaveBeenNthCalledWith(1, 1);
      expect(getDelayMs).toHaveBeenNthCalledWith(2, 2);
      expect(sleepMock).toHaveBeenNthCalledWith(1, 100);
      expect(sleepMock).toHaveBeenNthCalledWith(2, 200);
    });
  });

  describe('core behavior', () => {
    it('returns result on successful first attempt', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'success' });

      const result = await RetryPolicy.execute(fn);

      expect(result).toEqual({ data: 'success' });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('returns result after successful retry', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValueOnce('recovered');

      const result = await RetryPolicy.execute(fn);

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('preserves function return type', async () => {
      const fn = vi.fn().mockResolvedValue({ complex: { nested: 'value' }, array: [1, 2, 3] });

      const result = await RetryPolicy.execute(fn);

      expect(result).toEqual({ complex: { nested: 'value' }, array: [1, 2, 3] });
    });
  });
});

describe('RetryPolicy.createApiErrorFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('core behavior', () => {
    it('returns false for errors with APIError name', () => {
      const filter = RetryPolicy.createApiErrorFilter();
      const error = Object.assign(new Error('API error'), { name: 'APIError' });

      expect(filter(error, 0)).toBe(false);
    });

    it('returns false for errors with statusCode', () => {
      const filter = RetryPolicy.createApiErrorFilter();
      const error = Object.assign(new Error('HTTP error'), { statusCode: 429 });

      expect(filter(error, 0)).toBe(false);
    });

    it('returns true for regular errors without API markers', () => {
      const filter = RetryPolicy.createApiErrorFilter();
      const error = new Error('Network timeout');

      expect(filter(error, 0)).toBe(true);
    });

    it('returns true for errors with zero statusCode', () => {
      const filter = RetryPolicy.createApiErrorFilter();
      const error = Object.assign(new Error('test'), { statusCode: 0 });

      // statusCode of 0 is falsy, so should return true
      expect(filter(error, 0)).toBe(true);
    });
  });
});
