import { beforeEach, describe, expect, it, vi } from 'vitest';
import OptimizationConfig from '@config/OptimizationConfig';
import { deriveLockMap } from '@services/prompt-optimization/types/i2v';
import type {
  AIService,
  OptimizationMode,
  QualityAssessment,
} from '@services/prompt-optimization/types';
import { PromptOptimizationService } from '@services/prompt-optimization/PromptOptimizationService';

const quality = (score: number): QualityAssessment => ({
  score,
  details: {
    clarity: score,
    specificity: score,
    structure: score,
    completeness: score,
    actionability: score,
  },
  strengths: [],
  weaknesses: [],
});

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

  it('triggers quality-gate iterative refinement when initial score is below threshold', async () => {
    const service = createService();

    (service as unknown as { optimizationCache: unknown }).optimizationCache = {
      buildCacheKey: vi.fn(() => 'quality-key'),
      getCachedResult: vi.fn(async () => null),
      getCachedMetadata: vi.fn(async () => null),
      cacheResult: vi.fn(async () => {}),
    };

    (service as unknown as { shotInterpreter: unknown }).shotInterpreter = {
      interpret: vi.fn(async () => null),
    };

    const strategyOptimize = vi
      .fn()
      .mockResolvedValueOnce('base candidate prompt')
      .mockResolvedValue('iteratively refined prompt');

    (service as unknown as { strategyFactory: unknown }).strategyFactory = {
      getStrategy: vi.fn(() => ({
        name: 'video',
        optimize: strategyOptimize,
      })),
      getSupportedModes: vi.fn(() => ['video'] as OptimizationMode[]),
    };

    (service as unknown as { qualityAssessment: unknown }).qualityAssessment = {
      assessQuality: vi
        .fn()
        .mockResolvedValueOnce(quality(OptimizationConfig.quality.minAcceptableScore - 0.1))
        .mockResolvedValueOnce(quality(OptimizationConfig.quality.targetScore + 0.01))
        .mockResolvedValue(quality(OptimizationConfig.quality.targetScore + 0.01)),
    };

    const result = await service.optimize({
      prompt: 'seed prompt',
      skipCache: true,
    });

    expect(result.prompt).toBe('iteratively refined prompt');
    expect(result.metadata).toMatchObject({
      qualityGate: {
        triggered: true,
      },
    });
  });

  it('emits draft/refined callbacks during successful two-stage optimization', async () => {
    const service = createService();
    const onDraft = vi.fn();
    const onDraftChunk = vi.fn();
    const onRefinedChunk = vi.fn();

    (service as unknown as { shotInterpreter: unknown }).shotInterpreter = {
      interpret: vi.fn(async () => null),
    };

    (service as unknown as { draftService: unknown }).draftService = {
      supportsStreaming: vi.fn(() => true),
      generateDraft: vi.fn(
        async (
          _prompt: string,
          _mode: OptimizationMode,
          _shotPlan: unknown,
          _generationParams: unknown,
          _signal: AbortSignal | undefined,
          onChunk?: (delta: string) => void
        ) => {
          onChunk?.('draft-delta');
          return 'draft prompt';
        }
      ),
    };

    vi.spyOn(service, 'optimize').mockImplementation(async (request) => {
      request.onChunk?.('refined-delta');
      return {
        prompt: 'refined prompt',
        inputMode: 't2v',
        metadata: { source: 'refinement' },
      };
    });

    const result = await service.optimizeTwoStage({
      prompt: 'user prompt',
      onDraft,
      onDraftChunk,
      onRefinedChunk,
      skipCache: true,
    });

    expect(result.draft).toBe('draft prompt');
    expect(result.refined).toBe('refined prompt');
    expect(result.metadata).toMatchObject({ usedTwoStage: true });
    expect(onDraft).toHaveBeenCalledWith('draft prompt', null);
    expect(onDraftChunk).toHaveBeenCalledWith('draft-delta');
    expect(onRefinedChunk).toHaveBeenCalledWith('refined-delta');
  });

  it('falls back to single-stage optimization when draft streaming is unavailable', async () => {
    const service = createService();

    (service as unknown as { draftService: unknown }).draftService = {
      supportsStreaming: vi.fn(() => false),
      generateDraft: vi.fn(),
    };

    vi.spyOn(service, 'optimize').mockResolvedValue({
      prompt: 'single-stage prompt',
      inputMode: 't2v',
      metadata: { source: 'single-stage' },
    });

    const result = await service.optimizeTwoStage({
      prompt: 'fallback please',
      skipCache: true,
    });

    expect(result).toMatchObject({
      draft: 'single-stage prompt',
      refined: 'single-stage prompt',
      metadata: {
        usedFallback: true,
        source: 'single-stage',
      },
    });
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
    const compilePrompt = vi.fn(async () => ({
      compiledPrompt: 'compiled prompt',
      metadata: { compiledFor: 'kling-26' },
      targetModel: 'kling-26',
    }));
    (service as unknown as { compilationService: unknown }).compilationService = {
      compilePrompt,
    };

    const result = await service.compilePrompt({
      prompt: 'generic prompt',
      targetModel: 'kling',
    });

    expect(compilePrompt).toHaveBeenCalledWith('generic prompt', 'kling');
    expect(result).toEqual({
      compiledPrompt: 'compiled prompt',
      metadata: { compiledFor: 'kling-26' },
      targetModel: 'kling-26',
    });
  });
});
