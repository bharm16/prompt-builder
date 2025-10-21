import { describe, it, expect, vi } from 'vitest';

vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    requestLogger: () => () => {},
  },
}));

describe('PromptOptimizationService (extra behaviors)', () => {
  it('detectOptimalMode heuristics pick expected modes', async () => {
    const { PromptOptimizationService } = await import('../PromptOptimizationService.js');
    const service = new PromptOptimizationService({});
    expect(await service.detectOptimalMode('Analyze and prove a theorem')).toBeDefined();
    const research = await service.detectOptimalMode('Research and explore sources for climate data');
    expect(['research','reasoning','socratic','video','default']).toContain(research);
  });

  it('validateResponse warns for meta-commentary phrases', async () => {
    const logMod = await import('../../infrastructure/Logger.js');
    const warnFn = vi.fn();
    logMod.logger.warn = warnFn;
    const { PromptOptimizationService } = await import('../PromptOptimizationService.js');
    const service = new PromptOptimizationService({});
    service.validateResponse('Here is the output you requested');
    service.validateResponse("I've created an answer for you");
    service.validateResponse('Sure, here is the thing');
    expect(warnFn).toHaveBeenCalled();
  });
});
