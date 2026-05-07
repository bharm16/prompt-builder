/**
 * Rate-limit Redis health tracking.
 *
 * Tracks whether the Redis-backed rate limit store is currently healthy.
 * When unhealthy, LLM routes fail-closed (HTTP 503) rather than silently
 * degrading to per-instance in-memory limits that multiply effective
 * capacity by the Cloud Run instance count.
 *
 * Non-LLM routes may still fall back to in-memory with the existing divisor
 * — those are safe to degrade because they don't expose cost/abuse risk.
 *
 * Transitions (healthy → unhealthy, unhealthy → healthy) emit a single WARN
 * log for alerting. Repeated sets to the same state are no-ops to avoid
 * log flooding.
 */

import type { NextFunction, Request, Response } from "express";
import { logger } from "@infrastructure/Logger";

/**
 * Error thrown by the fail-closed middleware when Redis-backed rate limiting
 * is unavailable. The errorHandler maps this to HTTP 503 + Retry-After.
 */
export interface RateLimitUnavailableError extends Error {
  code: "RATE_LIMIT_UNAVAILABLE";
  retryAfter: number;
}

let rateLimitRedisHealthy = true;

/**
 * @returns true when the Redis store is accepting writes, false when it has
 *   transitioned to the degraded/unhealthy state.
 */
export function isRedisRateLimitHealthy(): boolean {
  return rateLimitRedisHealthy;
}

/**
 * Set the health flag. Only emits a warn log on actual transitions — calling
 * this repeatedly with the same value is a no-op for logging.
 */
export function setRedisRateLimitHealth(healthy: boolean): void {
  if (rateLimitRedisHealthy === healthy) {
    return;
  }

  rateLimitRedisHealthy = healthy;

  logger.warn("Rate limit Redis health transition", {
    operation: "rateLimit.redisHealthTransition",
    healthy,
    state: healthy ? "healthy" : "unhealthy",
  });
}

/**
 * Test-only helper to reset module state between tests.
 * @internal
 */
export function __resetRateLimitHealthForTest(): void {
  rateLimitRedisHealthy = true;
}

/**
 * Create a middleware that fails closed on LLM routes when Redis is unhealthy.
 *
 * When unhealthy, calls `next(err)` with a `RATE_LIMIT_UNAVAILABLE` error that
 * the global errorHandler maps to HTTP 503 with `Retry-After: 5`.
 *
 * When healthy, calls `next()` and control passes to the actual rate limiter.
 */
export function createFailClosedLlmRateLimit(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return function failClosedLlmRateLimit(
    _req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    if (rateLimitRedisHealthy) {
      next();
      return;
    }

    const err: RateLimitUnavailableError = Object.assign(
      new Error("Rate limiter temporarily unavailable, please retry."),
      {
        code: "RATE_LIMIT_UNAVAILABLE" as const,
        retryAfter: 5,
      },
    );
    next(err);
  };
}
