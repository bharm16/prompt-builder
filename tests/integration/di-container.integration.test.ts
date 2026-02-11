import { describe, expect, it } from 'vitest';
import { configureServices } from '@config/services.config';

describe('DI Container (integration)', () => {
  it('registers and resolves all configured services without throwing', async () => {
    const container = await configureServices();
    const serviceNames = container.getServiceNames();

    expect(serviceNames.length).toBeGreaterThan(0);

    for (const serviceName of serviceNames) {
      expect(() => container.resolve(serviceName)).not.toThrow();
    }
  }, 30_000);

  it('returns singleton instances for singleton registrations', async () => {
    const container = await configureServices();

    const logger1 = container.resolve('logger');
    const logger2 = container.resolve('logger');
    expect(logger1).toBe(logger2);
  });

  it('keeps continuity service resolvable when convergence is disabled', async () => {
    const previousEnableConvergence = process.env.ENABLE_CONVERGENCE;
    process.env.ENABLE_CONVERGENCE = 'false';

    try {
      const container = await configureServices();
      const continuityService = container.resolve('continuitySessionService');
      expect(continuityService).toBeNull();
    } finally {
      if (previousEnableConvergence === undefined) {
        delete process.env.ENABLE_CONVERGENCE;
        return;
      }
      process.env.ENABLE_CONVERGENCE = previousEnableConvergence;
    }
  });
});
