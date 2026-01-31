import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ensureGcsCredentials', () => {
  const originalGAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fallbackPath = path.resolve(process.cwd(), 'gcs-service-account.json');

  beforeEach(() => {
    vi.resetModules();
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalGAC !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = originalGAC;
    } else {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    vi.restoreAllMocks();
  });

  async function importFresh() {
    const mod = await import('../gcsCredentials');
    return mod.ensureGcsCredentials;
  }

  describe('error handling and edge cases', () => {
    it('only runs check logic once (idempotent)', async () => {
      const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const fn = await importFresh();

      fn();
      const callsAfterFirst = spy.mock.calls.length;
      fn();
      fn();
      expect(spy.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  describe('core behavior', () => {
    it('does not modify env when configured path exists', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/real/path.json';
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const fn = await importFresh();
      fn();
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe('/real/path.json');
    });

    it('uses fallback when configured path is a placeholder and fallback exists', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/service-account.json';
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (p === '/path/to/service-account.json') return false;
        if (p === fallbackPath) return true;
        return false;
      });

      const fn = await importFresh();
      fn();
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe(fallbackPath);
    });

    it('warns when configured path does not exist and is not a placeholder', async () => {
      const { logger } = await import('@infrastructure/Logger');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/some/real/missing.json';
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const fn = await importFresh();
      fn();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
        expect.objectContaining({ configuredPath: '/some/real/missing.json' })
      );
    });

    it('sets fallback path when GOOGLE_APPLICATION_CREDENTIALS not set and fallback exists', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === fallbackPath);

      const fn = await importFresh();
      fn();
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe(fallbackPath);
    });

    it('does nothing when no configured path and no fallback file', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const fn = await importFresh();
      fn();
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    });

    it('recognizes /path/to/ prefix as placeholder', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/my-credentials.json';
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.startsWith('/path/to/')) return false;
        if (p === fallbackPath) return true;
        return false;
      });

      const fn = await importFresh();
      fn();
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe(fallbackPath);
    });
  });
});
