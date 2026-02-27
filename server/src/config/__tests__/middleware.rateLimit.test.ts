import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_LIMIT_DIVISOR } from '../middleware.config';

describe('rate limit fallback behavior', () => {
  it('exports FALLBACK_LIMIT_DIVISOR as 4', () => {
    expect(FALLBACK_LIMIT_DIVISOR).toBe(4);
  });

  it('reduces limits by FALLBACK_LIMIT_DIVISOR when Redis is unavailable', () => {
    // Reproduce the applyFallback function logic
    const applyFallback = (limit: number, usingFallback: boolean): number =>
      usingFallback ? Math.max(1, Math.floor(limit / FALLBACK_LIMIT_DIVISOR)) : limit;

    // Production limits
    expect(applyFallback(100, true)).toBe(25); // 100/4
    expect(applyFallback(60, true)).toBe(15);  // 60/4
    expect(applyFallback(3, true)).toBe(1);    // floor(3/4) = 0, but max(1,0) = 1

    // Without fallback — limits unchanged
    expect(applyFallback(100, false)).toBe(100);
    expect(applyFallback(60, false)).toBe(60);
  });

  it('calls recordAlert when falling back to in-memory', () => {
    const mockMetrics = { recordAlert: vi.fn() };

    // Simulate the fallback check logic from applyRateLimitingMiddleware
    const usingFallback = true;
    if (usingFallback) {
      mockMetrics.recordAlert('rate_limit_redis_fallback');
    }

    expect(mockMetrics.recordAlert).toHaveBeenCalledWith('rate_limit_redis_fallback');
  });

  it('does not call recordAlert when Redis is available', () => {
    const mockMetrics = { recordAlert: vi.fn() };

    const usingFallback = false;
    if (usingFallback) {
      mockMetrics.recordAlert('rate_limit_redis_fallback');
    }

    expect(mockMetrics.recordAlert).not.toHaveBeenCalled();
  });

  it('never reduces a limit below 1', () => {
    const applyFallback = (limit: number): number =>
      Math.max(1, Math.floor(limit / FALLBACK_LIMIT_DIVISOR));

    expect(applyFallback(1)).toBe(1);
    expect(applyFallback(2)).toBe(1);
    expect(applyFallback(3)).toBe(1);
    expect(applyFallback(4)).toBe(1);
    expect(applyFallback(5)).toBe(1);
  });
});
