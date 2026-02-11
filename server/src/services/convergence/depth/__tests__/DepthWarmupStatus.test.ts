import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFalConfig = vi.fn();
const mockFalSubscribe = vi.fn();
const mockReplicateRun = vi.fn();
const mockReplicateCtor = vi.fn(() => ({
  run: mockReplicateRun,
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalVitest = process.env.VITEST;
const originalDepthWarmupOnStartup = process.env.DEPTH_WARMUP_ON_STARTUP;
const originalFalKey = process.env.FAL_KEY;
const originalFalApiKey = process.env.FAL_API_KEY;
const originalReplicateApiToken = process.env.REPLICATE_API_TOKEN;

const restoreEnvVar = (name: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
};

vi.mock('@fal-ai/client', () => ({
  fal: {
    config: mockFalConfig,
    subscribe: mockFalSubscribe,
  },
}));

vi.mock('replicate', () => ({
  default: mockReplicateCtor,
}));

describe('Depth warmup status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.NODE_ENV = 'development';
    delete process.env.VITEST;
    process.env.DEPTH_WARMUP_ON_STARTUP = 'true';
    delete process.env.FAL_KEY;
    delete process.env.FAL_API_KEY;
    process.env.REPLICATE_API_TOKEN = 'test-replicate-token';
  });

  afterEach(() => {
    restoreEnvVar('NODE_ENV', originalNodeEnv);
    restoreEnvVar('VITEST', originalVitest);
    restoreEnvVar('DEPTH_WARMUP_ON_STARTUP', originalDepthWarmupOnStartup);
    restoreEnvVar('FAL_KEY', originalFalKey);
    restoreEnvVar('FAL_API_KEY', originalFalApiKey);
    restoreEnvVar('REPLICATE_API_TOKEN', originalReplicateApiToken);
  });

  it('marks startup warmup as complete when replicate warmup succeeds', async () => {
    mockReplicateRun.mockResolvedValue('https://replicate.delivery/depth-warmup.png');

    const { getDepthWarmupStatus, warmupDepthEstimationOnStartup } = await import(
      '../DepthEstimationService'
    );

    expect(getDepthWarmupStatus().lastWarmupAt).toBe(0);

    const warmup = await warmupDepthEstimationOnStartup();

    expect(warmup).toMatchObject({
      success: true,
      provider: 'replicate',
    });
    expect(getDepthWarmupStatus()).toMatchObject({
      warmupInFlight: false,
    });
    expect(getDepthWarmupStatus().lastWarmupAt).toBeGreaterThan(0);
  });
});
