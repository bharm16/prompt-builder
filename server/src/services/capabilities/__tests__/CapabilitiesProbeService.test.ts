import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerDebug: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  setDynamicCapabilitiesRegistry: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      debug: mocks.loggerDebug,
      info: mocks.loggerInfo,
      warn: mocks.loggerWarn,
      error: vi.fn(),
    }),
  },
}));

vi.mock('../dynamicRegistry', () => ({
  setDynamicCapabilitiesRegistry: mocks.setDynamicCapabilitiesRegistry,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: mocks.readFile,
    default: {
      ...(actual as unknown as Record<string, unknown>),
      readFile: mocks.readFile,
    },
  };
});

import { CapabilitiesProbeService } from '../CapabilitiesProbeService';

describe('CapabilitiesProbeService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CAPABILITIES_PROBE_URL;
    delete process.env.CAPABILITIES_PROBE_PATH;
    delete process.env.CAPABILITIES_PROBE_REFRESH_MS;
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('does nothing when no URL or path is configured', () => {
    const service = new CapabilitiesProbeService();
    service.start();

    expect(mocks.loggerDebug).toHaveBeenCalledWith(
      'Capabilities probe disabled (no URL or path configured)'
    );
    expect(mocks.setDynamicCapabilitiesRegistry).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('loads registry from URL and updates dynamic registry', async () => {
    process.env.CAPABILITIES_PROBE_URL = 'https://capabilities.example.com/registry.json';
    process.env.CAPABILITIES_PROBE_REFRESH_MS = '1000';
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        openai: {
          'sora-2': { provider: 'openai', model: 'sora-2', version: '1.0', fields: {} },
        },
      }),
    })) as unknown as typeof fetch;

    const service = new CapabilitiesProbeService();
    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(mocks.setDynamicCapabilitiesRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        openai: expect.objectContaining({
          'sora-2': expect.objectContaining({ model: 'sora-2' }),
        }),
      })
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Capabilities registry updated',
      expect.objectContaining({ source: 'url' })
    );

    service.stop();
  });

  it('loads registry from file and updates dynamic registry', async () => {
    process.env.CAPABILITIES_PROBE_PATH = '/tmp/registry.json';
    process.env.CAPABILITIES_PROBE_REFRESH_MS = '1000';
    mocks.readFile.mockResolvedValue(
      JSON.stringify({
        wan: {
          'wan-2.2': { provider: 'wan', model: 'wan-2.2', version: '1.0', fields: {} },
        },
      })
    );

    const service = new CapabilitiesProbeService();
    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(mocks.readFile).toHaveBeenCalledWith('/tmp/registry.json', 'utf-8');
    expect(mocks.setDynamicCapabilitiesRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        wan: expect.objectContaining({
          'wan-2.2': expect.objectContaining({ model: 'wan-2.2' }),
        }),
      })
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Capabilities registry updated',
      expect.objectContaining({ source: 'file' })
    );

    service.stop();
  });

  it('handles refresh failures without throwing', async () => {
    process.env.CAPABILITIES_PROBE_URL = 'https://capabilities.example.com/registry.json';
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;

    const service = new CapabilitiesProbeService();
    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Failed to refresh capabilities registry',
      expect.objectContaining({ error: 'Capabilities probe failed (500)' })
    );
    expect(mocks.setDynamicCapabilitiesRegistry).not.toHaveBeenCalled();

    service.stop();
  });

  it('stops refresh interval when stop is called', async () => {
    process.env.CAPABILITIES_PROBE_URL = 'https://capabilities.example.com/registry.json';
    process.env.CAPABILITIES_PROBE_REFRESH_MS = '1000';
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;

    const service = new CapabilitiesProbeService();
    service.start();
    await vi.runOnlyPendingTimersAsync();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
