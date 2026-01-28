import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    createWebhookRoutesMock: vi.fn(() => ({ id: 'webhook' })),
  };
});

vi.mock('express', () => ({
  default: expressMock,
}));

vi.mock('@server/config/middleware.config.ts', () => ({
  configureMiddleware: configureMiddlewareMock,
}));

vi.mock('@server/config/routes.config.ts', () => ({
  configureRoutes: configureRoutesMock,
}));

vi.mock('@server/routes/payment.routes.ts', () => ({
  createWebhookRoutes: createWebhookRoutesMock,
}));

import { createApp } from '@server/app';

describe('createApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('throws when dependency resolution fails', () => {
      const container = {
        resolve: vi.fn(() => {
          throw new Error('resolve failed');
        }),
      };

      expect(() => createApp(container as never)).toThrow('resolve failed');
    });
  });

  describe('edge cases', () => {
    it('registers webhook routes before middleware', () => {
      const container = { resolve: vi.fn(() => ({ id: 'dep' })) };

      createApp(container as never);

      expect(useMock).toHaveBeenCalledWith('/api/payment', { id: 'webhook' });
      const useCallOrder = useMock.mock.invocationCallOrder[0];
      const middlewareCallOrder = configureMiddlewareMock.mock.invocationCallOrder[0];
      expect(useCallOrder).toBeLessThan(middlewareCallOrder);
    });
  });

  describe('core behavior', () => {
    it('sets trust proxy and wires routes with resolved dependencies', () => {
      const container = {
        resolve: vi.fn((token: string) => ({ token })),
      };

      const app = createApp(container as never);

      expect(app).toBe(appInstance);
      expect(setMock).toHaveBeenCalledWith('trust proxy', 1);
      expect(configureMiddlewareMock).toHaveBeenCalledWith(appInstance, {
        logger: { token: 'logger' },
        metricsService: { token: 'metricsService' },
      });
      expect(configureRoutesMock).toHaveBeenCalledWith(appInstance, container);
    });
  });
});
