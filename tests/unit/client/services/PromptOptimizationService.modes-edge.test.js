import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger to keep output clean
vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    requestLogger: () => () => {},
  },
}));

// Minimal cache service mock (not used directly here but required by import graph)
vi.mock('../CacheService.js', () => {
  return {
    cacheService: {
      getConfig: vi.fn(() => ({ ttl: 60, namespace: 'prompt-opt' })),
      generateKey: vi.fn(() => 'ns:key'),
      get: vi.fn(async () => null),
      set: vi.fn(async () => true),
      isHealthy: vi.fn(() => ({ healthy: true })),
      getCacheStats: vi.fn(() => ({ hits: 0, misses: 0 })),
    },
  };
});

describe('PromptOptimizationService - mode detection and system prompt edges', () => {
  let PromptOptimizationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ PromptOptimizationService } = await import('../PromptOptimizationService.js'));
  });

  describe('detectOptimalMode edge cases', () => {
    it('detects video mode with cinematic keywords (case-insensitive)', async () => {
      const service = new PromptOptimizationService({});
      const mode = await service.detectOptimalMode('CINEMATIC scene with CAMERA movement and FRAMES');
      expect(mode).toBe('video');
    });

    it('falls back to Claude intent analysis when scores are low', async () => {
      const mockClient = {
        complete: vi.fn(async () => ({ content: [{ text: 'socratic' }] })),
      };
      const service = new PromptOptimizationService(mockClient);
      const mode = await service.detectOptimalMode('hello world');
      expect(mockClient.complete).toHaveBeenCalled();
      expect(mode).toBe('socratic');
    });

    it('returns default when Claude intent analysis fails', async () => {
      const mockClient = { complete: vi.fn(async () => { throw new Error('network'); }) };
      const service = new PromptOptimizationService(mockClient);
      const mode = await service.detectOptimalMode('gibberish');
      expect(mode).toBe('default');
    });

    it('prefers earlier mode on exact score tie (stable order)', async () => {
      const service = new PromptOptimizationService({});
      const spy = vi.spyOn(service, 'calculateModeScore');
      // Return fixed scores to force a tie between reasoning and research
      // Order in implementation: reasoning, research, socratic, video
      let call = 0;
      spy.mockImplementation((_text, _keywords, _weight) => {
        // First 4 calls correspond to reasoning/research/socratic/video
        const map = [0.5, 0.5, 0.1, 0.1];
        return map[call++] ?? 0;
      });

      const mode = await service.detectOptimalMode('neutral');
      expect(mode).toBe('reasoning');
      spy.mockRestore();
    });
  });

  describe('buildSystemPrompt for video and socratic with context', () => {
    it('includes video template markers and appends context details', async () => {
      const service = new PromptOptimizationService({});
      const ctx = { specificAspects: 'golden hour lighting', backgroundLevel: 'expert', intendedUse: 'storyboard' };
      const sp = service.buildSystemPrompt('a cat on a rooftop', 'video', ctx);
      expect(sp).toMatch(/expert cinematographer|AI video generation/i);
      expect(sp).toMatch(/CREATIVE FOUNDATION|WHO - SUBJECT\/CHARACTER/);
      // Context addition
      expect(sp).toContain('IMPORTANT - User has provided additional context');
      expect(sp).toContain('Specific Focus Areas');
      expect(sp).toContain('Target Audience Level');
      expect(sp).toContain('Intended Use Case');
    });

    it('includes socratic template markers and appends context when provided', async () => {
      const service = new PromptOptimizationService({});
      const ctx = { specificAspects: 'focus on misconceptions', intendedUse: 'lesson plan' };
      const sp = service.buildSystemPrompt('teach recursion', 'socratic', ctx);
      expect(sp).toMatch(/Socratic learning guide/i);
      expect(sp).toMatch(/\*\*LEARNING OBJECTIVE\*\*/);
      // Context addition (only provided fields appear)
      expect(sp).toContain('Specific Focus Areas');
      expect(sp).not.toContain('Target Audience Level');
      expect(sp).toContain('Intended Use Case');
    });
  });
});

