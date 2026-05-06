import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { logger } from "@infrastructure/Logger";
import {
  isRedisRateLimitHealthy,
  setRedisRateLimitHealth,
  createFailClosedLlmRateLimit,
  __resetRateLimitHealthForTest,
} from "../rateLimitHealth";

describe("rateLimitHealth", () => {
  beforeEach(() => {
    __resetRateLimitHealthForTest();
    vi.clearAllMocks();
  });

  describe("health flag", () => {
    it("defaults to healthy on fresh import", () => {
      expect(isRedisRateLimitHealthy()).toBe(true);
    });

    it("flips to unhealthy when setRedisRateLimitHealth(false) is called", () => {
      setRedisRateLimitHealth(false);
      expect(isRedisRateLimitHealthy()).toBe(false);
    });

    it("flips back to healthy when setRedisRateLimitHealth(true) is called", () => {
      setRedisRateLimitHealth(false);
      setRedisRateLimitHealth(true);
      expect(isRedisRateLimitHealthy()).toBe(true);
    });
  });

  describe("transition logging", () => {
    it("logs a structured warn on healthy -> unhealthy transition", () => {
      setRedisRateLimitHealth(false);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operation: "rateLimit.redisHealthTransition",
          healthy: false,
        }),
      );
    });

    it("logs a structured warn on unhealthy -> healthy transition", () => {
      setRedisRateLimitHealth(false);
      vi.clearAllMocks();

      setRedisRateLimitHealth(true);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operation: "rateLimit.redisHealthTransition",
          healthy: true,
        }),
      );
    });

    it("does NOT log on repeated set-to-same-state calls", () => {
      // Already healthy by default — calling setRedisRateLimitHealth(true)
      // should be a no-op for logging.
      setRedisRateLimitHealth(true);
      setRedisRateLimitHealth(true);
      setRedisRateLimitHealth(true);
      expect(logger.warn).not.toHaveBeenCalled();

      // Transition once
      setRedisRateLimitHealth(false);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      // Further unhealthy calls must not log
      setRedisRateLimitHealth(false);
      setRedisRateLimitHealth(false);
      setRedisRateLimitHealth(false);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe("createFailClosedLlmRateLimit middleware", () => {
    const makeRes = (): Response => ({}) as Response;
    const makeReq = (): Request => ({}) as Request;

    it("calls next() with no error when health is healthy", () => {
      const middleware = createFailClosedLlmRateLimit();
      const next = vi.fn() as unknown as NextFunction;

      middleware(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it("calls next(err) with RATE_LIMIT_UNAVAILABLE when unhealthy", () => {
      setRedisRateLimitHealth(false);
      const middleware = createFailClosedLlmRateLimit();
      const next = vi.fn() as unknown as NextFunction;

      middleware(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      const callArg = (next as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0]?.[0];
      expect(callArg).toBeInstanceOf(Error);
      expect(callArg).toMatchObject({
        code: "RATE_LIMIT_UNAVAILABLE",
        retryAfter: 5,
      });
    });

    it("uses a fresh middleware — state is read on each request, not at creation", () => {
      const middleware = createFailClosedLlmRateLimit();
      const next1 = vi.fn() as unknown as NextFunction;
      const next2 = vi.fn() as unknown as NextFunction;

      // First request: healthy, should pass through
      middleware(makeReq(), makeRes(), next1);
      expect(next1).toHaveBeenCalledWith();

      // Flip unhealthy mid-process
      setRedisRateLimitHealth(false);

      // Second request on the SAME middleware instance: should fail closed
      middleware(makeReq(), makeRes(), next2);
      const arg = (next2 as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0]?.[0];
      expect(arg).toMatchObject({ code: "RATE_LIMIT_UNAVAILABLE" });
    });
  });
});
