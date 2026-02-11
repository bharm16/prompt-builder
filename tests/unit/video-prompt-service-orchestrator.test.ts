import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoPromptService } from '@services/video-prompt-analysis/VideoPromptService';
import type { PromptOptimizationResult } from '@services/video-prompt-analysis/strategies/types';

describe('VideoPromptService orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns original prompt when no model is detected', async () => {
    const service = new VideoPromptService();
    (service as unknown as { modelDetector: { detectTargetModel: (prompt: string) => null } }).modelDetector = {
      detectTargetModel: vi.fn(() => null),
    };

    const result = await service.optimizeForModel('A simple prompt');

    expect(result).toEqual({
      prompt: 'A simple prompt',
      metadata: {
        modelId: 'unknown',
        pipelineVersion: '1.0.0',
        phases: [],
        warnings: [],
        tokensStripped: [],
        triggersInjected: [],
      },
    });
  });

  it('normalizes model aliases before strategy lookup', async () => {
    const service = new VideoPromptService();
    const getMock = vi.fn(() => undefined);
    (service as unknown as { modelDetector: { detectTargetModel: (prompt: string) => string } }).modelDetector = {
      detectTargetModel: vi.fn(() => 'kling'),
    };
    (service as unknown as { strategyRegistry: { get: (modelId: string) => unknown } }).strategyRegistry = {
      get: getMock,
    };

    const result = await service.optimizeForModel('A model-specific prompt');

    expect(getMock).toHaveBeenCalledWith('kling-26');
    expect(result.metadata.modelId).toBe('kling-26');
  });

  it('returns original prompt with detected model when no strategy exists', async () => {
    const service = new VideoPromptService();
    (service as unknown as { modelDetector: { detectTargetModel: (prompt: string) => string } }).modelDetector = {
      detectTargetModel: vi.fn(() => 'sora-2'),
    };
    (service as unknown as { strategyRegistry: { get: (modelId: string) => undefined } }).strategyRegistry = {
      get: vi.fn(() => undefined),
    };

    const result = await service.optimizeForModel('A model-specific prompt');

    expect(result).toEqual({
      prompt: 'A model-specific prompt',
      metadata: {
        modelId: 'sora-2',
        pipelineVersion: '1.0.0',
        phases: [],
        warnings: [],
        tokensStripped: [],
        triggersInjected: [],
      },
    });
  });

  it('runs validate -> normalize -> transform -> augment pipeline and consolidates metadata', async () => {
    const service = new VideoPromptService();

    const strategy = {
      modelId: 'sora-2',
      modelName: 'Sora 2',
      validate: vi.fn(async () => undefined),
      normalize: vi.fn(() => 'normalized prompt'),
      transform: vi.fn(async () => ({
        prompt: 'transformed prompt',
        metadata: {
          phases: [{ phase: 'transform', durationMs: 2, changes: ['transform-change'] }],
          warnings: ['transform warning'],
          tokensStripped: ['token-a'],
          triggersInjected: [],
        },
      })),
      augment: vi.fn(() => ({
        prompt: 'augmented prompt',
        metadata: {
          phases: [{ phase: 'augment', durationMs: 1, changes: ['augment-change'] }],
          warnings: [],
          tokensStripped: [],
          triggersInjected: ['trigger-a'],
        },
      })),
    };

    (service as unknown as { modelDetector: { detectTargetModel: (prompt: string) => string } }).modelDetector = {
      detectTargetModel: vi.fn(() => 'sora-2'),
    };
    (service as unknown as { strategyRegistry: { get: (modelId: string) => unknown } }).strategyRegistry = {
      get: vi.fn(() => strategy),
    };

    const result = await service.optimizeForModel('input prompt');

    expect(strategy.validate).toHaveBeenCalledWith('input prompt', undefined);
    expect(strategy.normalize).toHaveBeenCalledWith('input prompt', undefined);
    expect(strategy.transform).toHaveBeenCalledWith('normalized prompt', undefined);
    expect(strategy.augment).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'transformed prompt' }),
      undefined
    );
    expect(result).toEqual({
      prompt: 'augmented prompt',
      metadata: {
        modelId: 'sora-2',
        pipelineVersion: '1.0.0',
        phases: expect.arrayContaining([
          expect.objectContaining({ phase: 'normalize' }),
          expect.objectContaining({ phase: 'transform' }),
          expect.objectContaining({ phase: 'augment' }),
        ]),
        warnings: [],
        tokensStripped: ['token-a'],
        triggersInjected: ['trigger-a'],
      },
    });
  });

  it('isolates failures per model in translateToAllModels', async () => {
    const service = new VideoPromptService();

    (service as unknown as { strategyRegistry: { getAll: () => Array<{ modelId: string }> } }).strategyRegistry = {
      getAll: vi.fn(() => [{ modelId: 'runway-gen45' }, { modelId: 'sora-2' }]),
    };

    vi.spyOn(service, 'optimizeForModel').mockImplementation(
      async (prompt: string, modelId?: string | null): Promise<PromptOptimizationResult> => {
        if (modelId === 'runway-gen45') {
          throw new Error('runway unavailable');
        }
        return {
          prompt: `${prompt} :: optimized`,
          metadata: {
            modelId: modelId || 'unknown',
            pipelineVersion: '1.0.0',
            phases: [],
            warnings: [],
            tokensStripped: [],
            triggersInjected: [],
          },
        };
      }
    );

    const results = await service.translateToAllModels('source prompt');

    expect(results.size).toBe(2);
    expect(results.get('sora-2')).toEqual(
      expect.objectContaining({
        prompt: 'source prompt :: optimized',
      })
    );
    expect(results.get('runway-gen45')).toEqual(
      expect.objectContaining({
        prompt: 'source prompt',
        metadata: expect.objectContaining({
          warnings: ['Optimization failed: runway unavailable'],
        }),
      })
    );
  });

  it('delegates supported model queries to the strategy registry', () => {
    const service = new VideoPromptService();
    const getModelIds = vi.fn(() => ['runway-gen45', 'sora-2']);
    const has = vi.fn((modelId: string) => modelId === 'sora-2');

    (service as unknown as {
      strategyRegistry: {
        getModelIds: () => string[];
        has: (modelId: string) => boolean;
      };
    }).strategyRegistry = { getModelIds, has };

    expect(service.getSupportedModelIds()).toEqual(['runway-gen45', 'sora-2']);
    expect(service.isModelSupported('sora-2')).toBe(true);
    expect(service.isModelSupported('unknown-model')).toBe(false);
  });
});
