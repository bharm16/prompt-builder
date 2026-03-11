import { describe, expect, it, vi } from 'vitest';
import { runOptimizeFlow } from '../optimizeFlow';

describe('runOptimizeFlow stream parity', () => {
  const baseDeps = {
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    optimizationCache: {
      buildCacheKey: vi.fn(() => 'cache-key'),
      getCachedResult: vi.fn(async () => null),
      getCachedMetadata: vi.fn(async () => null),
      cacheResult: vi.fn(async () => undefined),
    },
    shotInterpreter: {
      interpret: vi.fn(async () => null),
    },
    strategyFactory: {
      getStrategy: vi.fn(() => ({
        optimize: vi.fn(async () => 'generic optimized prompt'),
        generateDomainContent: vi.fn(async () => null),
      })),
    },
    compilationService: {
      compile: vi.fn(async () => ({
        prompt: 'final compiled prompt for target model',
        metadata: { normalizedModelId: 'veo-3' },
        compilation: {
          status: 'compiled',
          usedFallback: false,
          sourceKind: 'prompt',
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: 'veo-3',
        },
      })),
    },
    applyConstitutionalAI: vi.fn(async (prompt: string) => prompt),
    logOptimizationMetrics: vi.fn(),
    intentLock: {
      enforceIntentLock: vi.fn(({ optimizedPrompt }) => ({
        prompt: optimizedPrompt,
        passed: true,
        repaired: false,
        required: { subject: 'baby', action: 'driving' },
      })),
    },
    promptLint: {
      enforce: vi.fn(({ prompt }) => ({
        prompt,
        lint: { ok: true, errors: [], warnings: [], wordCount: prompt.split(/\s+/).length },
        repaired: false,
      })),
    },
  };

  it('uses originalUserPrompt from brainstorm context when enforcing intent lock', async () => {
    vi.clearAllMocks();

    await runOptimizeFlow({
      ...baseDeps,
      request: {
        prompt: 'draft prompt that drifted',
        mode: 'video',
        targetModel: 'veo-3',
        brainstormContext: {
          originalUserPrompt: 'baby driving a car',
        },
      },
    } as never);

    expect(baseDeps.intentLock.enforceIntentLock).toHaveBeenCalled();
    expect(baseDeps.intentLock.enforceIntentLock).toHaveBeenCalledWith(
      expect.objectContaining({
        originalPrompt: 'baby driving a car',
      })
    );
  });
});
