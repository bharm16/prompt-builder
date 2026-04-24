import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useMock,
  setMock,
  appInstance,
  expressMock,
  configureMiddlewareMock,
  configureRoutesMock,
  createWebhookRoutesMock,
  initializeDepthWarmerMock,
  getRuntimeFlagsMock,
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
    initializeDepthWarmerMock: vi.fn(),
    getRuntimeFlagsMock: vi.fn(() => ({ processRole: "api" })),
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

vi.mock("@services/convergence/depth", () => ({
  initializeDepthWarmer: initializeDepthWarmerMock,
}));

vi.mock("@server/config/feature-flags.ts", () => ({
  getRuntimeFlags: getRuntimeFlagsMock,
}));

import { createApp } from "@server/app";

const PAYMENT_TOKENS = new Set([
  "paymentService",
  "stripeWebhookEventStore",
  "billingProfileStore",
  "userCreditService",
  "paymentConsistencyStore",
  "metricsService",
  "firestoreCircuitExecutor",
]);

function buildContainer(): { resolve: ReturnType<typeof vi.fn> } {
  return {
    resolve: vi.fn((token: string) => ({ token })),
  };
}

describe("createApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeFlagsMock.mockReturnValue({ processRole: "api" });
  });

  describe("dependency resolution", () => {
    it("propagates errors when the container fails to resolve a token", () => {
      const container = {
        resolve: vi.fn(() => {
          throw new Error("resolve failed");
        }),
      };

      expect(() => createApp(container as never)).toThrow("resolve failed");
    });
  });

  describe("edge cases", () => {
    it("registers webhook routes before middleware", () => {
      const container = buildContainer();

      createApp(container as never);

      expect(useMock).toHaveBeenCalledWith("/api/payment", { id: "webhook" });
      const useCallOrder = useMock.mock.invocationCallOrder[0];
      const middlewareCallOrder =
        configureMiddlewareMock.mock.invocationCallOrder[0];
      expect(useCallOrder).toBeDefined();
      expect(middlewareCallOrder).toBeDefined();
      expect(useCallOrder ?? 0).toBeLessThan(middlewareCallOrder ?? 0);
    });

    it("skips depth warmup when role is worker", () => {
      getRuntimeFlagsMock.mockReturnValue({ processRole: "worker" });
      const container = buildContainer();

      createApp(container as never);

      expect(initializeDepthWarmerMock).not.toHaveBeenCalled();
    });
  });

  describe("core behavior", () => {
    it("sets trust proxy and wires routes with services resolved from the container", () => {
      const container = buildContainer();

      const app = createApp(container as never);

      expect(app).toBe(appInstance);
      expect(setMock).toHaveBeenCalledWith("trust proxy", 1);
      expect(configureMiddlewareMock).toHaveBeenCalledWith(appInstance, {
        logger: { token: "logger" },
        metricsService: { token: "metricsService" },
        redisClient: { token: "redisClient" },
      });
      expect(configureRoutesMock).toHaveBeenCalledWith(appInstance, container);
      expect(initializeDepthWarmerMock).toHaveBeenCalledTimes(1);

      const resolvedTokens = container.resolve.mock.calls.map(
        ([token]) => token,
      );
      for (const token of PAYMENT_TOKENS) {
        expect(resolvedTokens).toContain(token);
      }
    });
  });
});
