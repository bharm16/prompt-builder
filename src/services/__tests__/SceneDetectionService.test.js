import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SceneDetectionService } from '../SceneDetectionService.js';

// Mock dependencies
vi.mock('../../infrastructure/Logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../CacheService.js', () => ({
  cacheService: {
    getConfig: vi.fn(() => ({ ttl: 60, namespace: 'scene' })),
    generateKey: vi.fn((ns, data) => `${ns}:${JSON.stringify(data).length}`),
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
  },
}));

vi.mock('../../utils/StructuredOutputEnforcer.js', () => ({
  StructuredOutputEnforcer: {
    enforceJSON: vi.fn(async () => ({
      isSceneChange: true,
      confidence: 'high',
      reasoning: 'Different environment',
      suggestedUpdates: { location: 'beach', lighting: 'sunny' },
    })),
  },
}));

vi.mock('../../utils/TemperatureOptimizer.js', () => ({
  TemperatureOptimizer: {
    getOptimalTemperature: vi.fn(() => 0.2),
  },
}));

describe('SceneDetectionService', () => {
  let service;
  let fakeClaude;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeClaude = { _makeRequest: vi.fn() };
    service = new SceneDetectionService(fakeClaude);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls enforcer and caches result on miss', async () => {
    const params = {
      changedField: 'location',
      newValue: 'beach',
      oldValue: 'office',
      fullPrompt: 'We moved from office to beach',
      affectedFields: ['location', 'lighting'],
    };
    const result = await service.detectSceneChange(params);
    expect(result.isSceneChange).toBe(true);
    // Ensure cache set called
    const { cacheService } = await import('../CacheService.js');
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('returns cached result when available', async () => {
    const { cacheService } = await import('../CacheService.js');
    cacheService.get.mockResolvedValueOnce({
      isSceneChange: false,
      confidence: 'low',
      reasoning: 'Minor refinement',
      suggestedUpdates: {},
    });

    const out = await service.detectSceneChange({
      changedField: 'location',
      newValue: 'vintage coffee shop',
      oldValue: 'coffee shop',
      fullPrompt: 'Refinement',
      affectedFields: ['location'],
    });
    expect(out.isSceneChange).toBe(false);
  });
});
