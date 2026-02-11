import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFalConfig = vi.fn();
const mockFalSubscribe = vi.fn();

const originalNodeEnv = process.env.NODE_ENV;
const originalVitest = process.env.VITEST;
const originalDepthWarmupOnStartup = process.env.DEPTH_WARMUP_ON_STARTUP;
const originalFalKey = process.env.FAL_KEY;
const originalFalApiKey = process.env.FAL_API_KEY;

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

describe('Depth warmup status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.NODE_ENV = 'development';
    delete process.env.VITEST;
    process.env.DEPTH_WARMUP_ON_STARTUP = 'true';
    process.env.FAL_KEY = 'test-fal-key';
    delete process.env.FAL_API_KEY;
  });

  afterEach(() => {
    restoreEnvVar('NODE_ENV', originalNodeEnv);
    restoreEnvVar('VITEST', originalVitest);
    restoreEnvVar('DEPTH_WARMUP_ON_STARTUP', originalDepthWarmupOnStartup);
    restoreEnvVar('FAL_KEY', originalFalKey);
    restoreEnvVar('FAL_API_KEY', originalFalApiKey);
  });

  it('marks startup warmup as complete when fal warmup succeeds', async () => {
    mockFalSubscribe.mockResolvedValue({
      data: {
        image: {
          url: 'https://fal.media/files/depth-warmup.png',
          content_type: 'image/png',
        },
      },
    });

    const { getDepthWarmupStatus, warmupDepthEstimationOnStartup } = await import(
      '../DepthEstimationService'
    );

    expect(getDepthWarmupStatus().lastWarmupAt).toBe(0);

    const warmup = await warmupDepthEstimationOnStartup();

    expect(warmup).toMatchObject({
      success: true,
      provider: 'fal.ai',
    });
    expect(getDepthWarmupStatus()).toMatchObject({
      warmupInFlight: false,
    });
    expect(getDepthWarmupStatus().lastWarmupAt).toBeGreaterThan(0);
  });
});
