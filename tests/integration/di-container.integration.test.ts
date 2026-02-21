import { describe, expect, it } from 'vitest';
import { configureServices } from '@config/services.config';
import type { StorageService } from '@services/storage/StorageService';

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

  it('exercises real GCS storage boundary in CI', async () => {
    if (process.env.CI !== 'true') {
      expect(true).toBe(true);
      return;
    }

    const container = await configureServices();
    const storageService = container.resolve<StorageService>('storageService');
    const userId = `api-key:ci-storage-user-${Date.now()}`;
    const otherUserId = `${userId}-other`;

    const saved = await storageService.saveFromBuffer(
      userId,
      Buffer.from('integration-image-bytes'),
      'preview-image',
      'image/png',
      { source: 'integration-test' }
    );

    expect(saved.storagePath).toContain(`users/${userId}/previews/images/`);

    const view = await storageService.getViewUrl(userId, saved.storagePath);
    expect(view.storagePath).toBe(saved.storagePath);
    expect(view.viewUrl.length).toBeGreaterThan(0);

    await expect(storageService.getViewUrl(otherUserId, saved.storagePath)).rejects.toMatchObject({
      statusCode: 403,
    });

    await storageService.deleteFile(userId, saved.storagePath);
  }, 30_000);
});
