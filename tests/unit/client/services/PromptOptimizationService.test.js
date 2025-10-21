import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptOptimizationService } from '../PromptOptimizationService.js';

vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    requestLogger: () => () => {},
  },
}));

// Mock cache service singleton
vi.mock('../CacheService.js', () => {
  const generateKey = vi.fn(() => 'ns:key');
  const get = vi.fn(async () => null);
  const set = vi.fn(async () => true);
  const getConfig = vi.fn(() => ({ ttl: 111, namespace: 'prompt' }));
  return {
    cacheService: { generateKey, get, set, getConfig },
  };
});

// Mock temperature optimizer
vi.mock('../../utils/TemperatureOptimizer.js', () => ({
  TemperatureOptimizer: {
    getOptimalTemperature: vi.fn(() => 0.5),
  },
}));

// Mock ConstitutionalAI
vi.mock('../../utils/ConstitutionalAI.js', () => ({
  ConstitutionalAI: {
    getPrinciplesForDomain: vi.fn(() => ['p1']),
    applyConstitutionalReview: vi.fn(async (_client, _orig, out) => ({ output: `REVISED:${out}`, revised: true, improvements: [] })),
  },
}));

describe('PromptOptimizationService', () => {
  let client;
  let service;
  let cache;

  beforeEach(async () => {
    vi.clearAllMocks();
    client = { complete: vi.fn(async () => ({ content: [{ text: 'OUT' }], usage: { input_tokens: 10, output_tokens: 20 } })) };
    const modCache = await import('../CacheService.js');
    cache = modCache.cacheService;
    service = new PromptOptimizationService(client);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildSystemPrompt produces correct templates per mode', () => {
    const codePrompt = service.buildSystemPrompt('do x', 'code');
    expect(codePrompt).toContain('**GOAL**');
    const researchPrompt = service.buildSystemPrompt('research y', 'research');
    expect(researchPrompt).toContain('**RESEARCH OBJECTIVE**');
  });

  it('appends context addition when context provided', () => {
    const ctx = { specificAspects: 'performance', backgroundLevel: 'beginner', intendedUse: 'documentation' };
    const sp = service.buildSystemPrompt('task', 'code', ctx);
    expect(sp).toContain('IMPORTANT - User has provided additional context');
    expect(sp).toContain('Specific Focus Areas');
    expect(sp).toContain('Target Audience Level');
    expect(sp).toContain('Intended Use Case');
  });

  it('uses cache for optimize and sets result with configured ttl', async () => {
    const out = await service.optimize({ prompt: 'p', mode: 'code' });
    expect(typeof out).toBe('string');
    // generateKey called with templateVersion included
    const generateArgs = cache.generateKey.mock.calls[0][1];
    expect(generateArgs).toHaveProperty('templateVersion');
    expect(cache.get).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
    const setArgs = cache.set.mock.calls[0][2];
    expect(setArgs.ttl).toBe(111);
  });

  it('optimize with ConstitutionalAI returns revised output and caches it', async () => {
    const out = await service.optimize({ prompt: 'p', mode: 'code', useConstitutionalAI: true });
    expect(out.startsWith('REVISED:')).toBe(true);
    expect(cache.set).toHaveBeenCalled();
  });

  it('optimizeIteratively returns object and caches when requested', async () => {
    // Speed through iteration by stubbing quality assessment
    const assessSpy = vi.spyOn(service, 'assessPromptQuality').mockResolvedValue({ score: 0.95 });
    const weakSpy = vi.spyOn(service, 'identifyWeaknesses').mockResolvedValue([]);
    const result = await service.optimize({ prompt: 'p', mode: 'code', useIterativeRefinement: true });
    expect(result).toHaveProperty('prompt');
    expect(result).toHaveProperty('quality');
    expect(cache.set).toHaveBeenCalled();
    assessSpy.mockRestore();
    weakSpy.mockRestore();
  });
});

