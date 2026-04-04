import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useMock,
  setMock,
  appInstance,
  expressMock,
  configureMiddlewareMock,
  configureRoutesMock,
  createWebhookRoutesMock,
} = vi.hoisted(() => {
  const useMock = vi.fn();
  const setMock = vi.fn();
  const appInstance = {
    use: useMock,
    set: setMock,
  };

  return {
    useMock,
    setMock,
    appInstance,
    expressMock: vi.fn(() => appInstance),
    configureMiddlewareMock: vi.fn(),
    configureRoutesMock: vi.fn(),
    createWebhookRoutesMock: vi.fn(() => ({ id: "webhook" })),
  };
});

vi.mock("express", () => ({
  default: expressMock,
}));

vi.mock("@server/config/middleware.config.ts", () => ({
  configureMiddleware: configureMiddlewareMock,
}));

vi.mock("@server/config/routes.config.ts", () => ({
  configureRoutes: configureRoutesMock,
}));

vi.mock("@server/routes/payment.routes.ts", () => ({
  createWebhookRoutes: createWebhookRoutesMock,
}));

import { createApp } from "@server/app";
import { resolveAppDependencies } from "@server/config/app.dependencies.ts";

describe("createApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dependency resolution", () => {
    it("throws when app dependency resolution fails", () => {
      const container = {
        resolve: vi.fn(() => {
          throw new Error("resolve failed");
        }),
      };

      expect(() => resolveAppDependencies(container as never)).toThrow(
        "resolve failed",
      );
    });
  });

  describe("edge cases", () => {
    it("registers webhook routes before middleware", () => {
      const dependencies = {
        routeContainer: { resolve: vi.fn() },
        paymentRouteServices: {
          paymentService: { id: "paymentService" },
        },
        middlewareServices: {
          logger: { id: "logger" },
          metricsService: { id: "metrics" },
          redisClient: { id: "redis" },
        },
      };

      createApp(dependencies as never);

      expect(useMock).toHaveBeenCalledWith("/api/payment", { id: "webhook" });
      const useCallOrder = useMock.mock.invocationCallOrder[0];
      const middlewareCallOrder =
        configureMiddlewareMock.mock.invocationCallOrder[0];
      expect(useCallOrder).toBeDefined();
      expect(middlewareCallOrder).toBeDefined();
      expect(useCallOrder ?? 0).toBeLessThan(middlewareCallOrder ?? 0);
    });
  });

  describe("core behavior", () => {
    it("sets trust proxy and wires routes with explicit dependencies", () => {
      const routeContainer = {
        resolve: vi.fn((token: string) => ({ token })),
      };
      const dependencies = {
        routeContainer,
        paymentRouteServices: {
          paymentService: { token: "paymentService" },
        },
        middlewareServices: {
          logger: { token: "logger" },
          metricsService: { token: "metricsService" },
          redisClient: { token: "redisClient" },
        },
      };

      const app = createApp(dependencies as never);

      expect(app).toBe(appInstance);
      expect(setMock).toHaveBeenCalledWith("trust proxy", 1);
      expect(configureMiddlewareMock).toHaveBeenCalledWith(appInstance, {
        logger: { token: "logger" },
        metricsService: { token: "metricsService" },
        redisClient: { token: "redisClient" },
      });
      expect(configureRoutesMock).toHaveBeenCalledWith(
        appInstance,
        routeContainer,
      );
    });
  });
});
