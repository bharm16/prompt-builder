import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveLockMap } from '@services/prompt-optimization/types/i2v';
import type {
  AIService,
} from '@services/prompt-optimization/types';
import { PromptOptimizationService } from '@services/prompt-optimization/PromptOptimizationService';

const createService = (): PromptOptimizationService => {
  const aiService: AIService = {
    execute: vi.fn(async () => ({
      text: '',
      content: [{ text: '' }],
      metadata: {
        model: 'mock',
        provider: 'mock',
        finishReason: 'stop',
        usage: null,
      },
    })),
    getAvailableClients: vi.fn(() => ['mock']),
  };

  const cacheService = {
    getConfig: vi.fn(() => ({ ttl: 60, namespace: 'test' })),
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    generateKey: vi.fn(() => 'cache-key'),
  } as never;

  const imageObservationService = {
    observeImage: vi.fn(async () => ({ description: '', tags: [] })),
  } as never;

  return new PromptOptimizationService(aiService, cacheService, null, imageObservationService);
};

describe('PromptOptimizationService contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached optimize response and emits cached metadata', async () => {
    const service = createService();
    const onMetadata = vi.fn();

    (service as unknown as { optimizationCache: unknown }).optimizationCache = {
      buildCacheKey: vi.fn(() => 'cache-key'),
      getCachedResult: vi.fn(async () => 'cached optimized prompt'),
      getCachedMetadata: vi.fn(async () => ({ source: 'cache', score: 0.9 })),
      cacheResult: vi.fn(async () => {}),
    };

    const result = await service.optimize({
      prompt: 'optimize this',
      onMetadata,
    });

    expect(result).toEqual({
      prompt: 'cached optimized prompt',
      inputMode: 't2v',
      metadata: { source: 'cache', score: 0.9 },
    });
    expect(onMetadata).toHaveBeenCalledWith({ source: 'cache', score: 0.9 });
  });

  it('routes optimize requests with startImage through i2v and preserves inputMode', async () => {
    const service = createService();

    (service as unknown as { imageObservation: unknown }).imageObservation = {
      observe: vi.fn(async () => ({
        observation: { subject: 'runner' },
        cached: false,
        usedFastPath: false,
      })),
    };

    (service as unknown as { i2vStrategy: unknown }).i2vStrategy = {
      optimize: vi.fn(async () => ({
        prompt: 'i2v optimized prompt',
        conflicts: [],
        appliedMode: 'strict',
        lockMap: deriveLockMap('strict'),
        extractedMotion: {
          subjectAction: null,
          cameraMovement: null,
          pacing: null,
        },
      })),
    };

    const result = await service.optimize({
      prompt: 'make this move',
      startImage: 'https://images.example.com/start.webp',
    });

    expect(result.inputMode).toBe('i2v');
    expect(result.prompt).toBe('i2v optimized prompt');
    expect(result.i2v?.appliedMode).toBe('strict');
  });

  it('throws when compilePrompt is called without a compilation service', async () => {
    const service = createService();
    (service as unknown as { compilationService: unknown }).compilationService = null;

    await expect(
      service.compilePrompt({
        prompt: 'generic prompt',
        targetModel: 'kling',
      })
    ).rejects.toThrow('Video prompt service unavailable');
  });

  it('delegates compilePrompt when compilation service is available', async () => {
    const service = createService();
    const compile = vi.fn(async () => ({
      prompt: 'compiled prompt',
      metadata: {
        compiledFor: 'kling-2.1',
        compilation: {
          status: 'compiled',
          usedFallback: false,
          sourceKind: 'prompt',
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: 'kling-2.1',
        },
      },
      compilation: {
        status: 'compiled',
        usedFallback: false,
        sourceKind: 'prompt',
        structuredArtifactReused: false,
        analyzerBypassed: false,
        compiledFor: 'kling-2.1',
      },
    }));
    (service as unknown as { compilationService: unknown }).compilationService = {
      compile,
    };

    const result = await service.compilePrompt({
      prompt: 'generic prompt',
      targetModel: 'kling',
    });

    expect(compile).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'compilePrompt',
        targetModel: 'kling',
        source: { kind: 'prompt', prompt: 'generic prompt' },
      })
    );
    expect(result).toMatchObject({
      metadata: { compiledFor: 'kling-2.1' },
      targetModel: 'kling-2.1',
    });
  });
});
