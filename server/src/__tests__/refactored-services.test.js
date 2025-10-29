import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyContainer } from '../infrastructure/DependencyContainer.js';
import { registerRefactoredServices } from '../infrastructure/ServiceRegistration.refactored.js';
import { AIResponse } from '../interfaces/IAIClient.js';

describe('Refactored Services Integration', () => {
  let container;

  beforeEach(() => {
    container = new DependencyContainer();
    
    const testConfig = {
      logLevel: 'error', // Quiet during tests
    };
    
    registerRefactoredServices(container, testConfig);
  });

  describe('DependencyContainer', () => {
    it('resolves registered services', () => {
      const logger = container.resolve('logger');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('returns same instance for singletons', () => {
      const logger1 = container.resolve('logger');
      const logger2 = container.resolve('logger');
      expect(logger1).toBe(logger2);
    });

    it('throws error for unregistered service', () => {
      expect(() => container.resolve('nonexistent')).toThrow('Service not registered');
    });
  });

  describe('Cache Services', () => {
    it('creates cache service with statistics', async () => {
      const cacheService = container.resolve('cacheService');
      
      expect(cacheService).toBeDefined();
      expect(typeof cacheService.get).toBe('function');
      expect(typeof cacheService.set).toBe('function');
      expect(typeof cacheService.generateKey).toBe('function');
      expect(typeof cacheService.getStatistics).toBe('function');
    });

    it('generates cache keys', () => {
      const cacheService = container.resolve('cacheService');
      
      const key = cacheService.generateKey('test', { prompt: 'hello' });
      
      expect(typeof key).toBe('string');
      expect(key).toContain('test:');
    });

    it('tracks cache statistics', async () => {
      const cacheService = container.resolve('cacheService');
      
      // Set a value
      await cacheService.set('testKey', 'testValue');
      
      // Hit
      const value1 = await cacheService.get('testKey');
      expect(value1).toBe('testValue');
      
      // Miss
      const value2 = await cacheService.get('nonexistent');
      expect(value2).toBeNull();
      
      // Check statistics
      const stats = cacheService.getStatistics();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
    });
  });

  describe('Mode Registry', () => {
    it('registers and retrieves modes', () => {
      const modeRegistry = container.resolve('modeRegistry');
      
      expect(modeRegistry.has('reasoning')).toBe(true);
      
      const reasoningMode = modeRegistry.get('reasoning');
      expect(reasoningMode.getName()).toBe('reasoning');
    });

    it('throws error for unknown mode', () => {
      const modeRegistry = container.resolve('modeRegistry');
      
      expect(() => modeRegistry.get('nonexistent')).toThrow('Unknown optimization mode');
    });
  });

  describe('ContextInferenceService', () => {
    it('infers context from prompt', async () => {
      // Mock AI client
      const mockClient = {
        complete: vi.fn().mockResolvedValue(
          new AIResponse('{"specificAspects": "React", "backgroundLevel": "intermediate", "intendedUse": "debugging"}')
        )
      };
      
      const contextService = container.resolve('contextInferenceService');
      contextService.client = mockClient; // Replace with mock
      
      const context = await contextService.infer('help me debug my React app');
      
      expect(context).toEqual({
        specificAspects: 'React',
        backgroundLevel: 'intermediate',
        intendedUse: 'debugging',
      });
      
      expect(mockClient.complete).toHaveBeenCalledWith(
        expect.stringContaining('Analyze this prompt'),
        expect.any(Object)
      );
    });

    it('returns fallback on error', async () => {
      const mockClient = {
        complete: vi.fn().mockRejectedValue(new Error('API error'))
      };
      
      const contextService = container.resolve('contextInferenceService');
      contextService.client = mockClient;
      
      const context = await contextService.infer('test');
      
      expect(context).toEqual({
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: '',
      });
    });
  });

  describe('ReasoningMode', () => {
    it('generates system prompt', () => {
      const modeRegistry = container.resolve('modeRegistry');
      const reasoningMode = modeRegistry.get('reasoning');
      
      const systemPrompt = reasoningMode.generateSystemPrompt(
        'test prompt',
        null,
        null
      );
      
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt).toContain('Transform the user');
      expect(systemPrompt).toContain('test prompt');
    });

    it('generates draft prompt', () => {
      const modeRegistry = container.resolve('modeRegistry');
      const reasoningMode = modeRegistry.get('reasoning');
      
      const draftPrompt = reasoningMode.generateDraftPrompt('test', null);
      
      expect(typeof draftPrompt).toBe('string');
      expect(draftPrompt).toContain('draft');
    });
  });

  describe('PromptOptimizationOrchestrator', () => {
    it('optimizes prompt with reasoning mode', async () => {
      // Mock AI client that returns proper structure
      const mockComplete = vi.fn()
        .mockResolvedValueOnce(
          new AIResponse('{"specificAspects": "React", "backgroundLevel": "intermediate", "intendedUse": "debugging"}')
        )
        .mockResolvedValueOnce(
          new AIResponse('{"warnings": [], "deliverables": [], "constraints": []}')
        )
        .mockResolvedValueOnce(
          new AIResponse('Optimized prompt result')
        );
      
      const mockClient = {
        complete: mockComplete
      };
      
      const orchestrator = container.resolve('promptOptimizationServiceRefactored');
      
      // Replace AI client with mock
      orchestrator.contextInferenceService.client = mockClient;
      orchestrator.twoStageService.refinementClient = mockClient;
      
      const result = await orchestrator.optimize({
        prompt: 'help me debug my React app',
        modeName: 'reasoning',
        useTwoStage: false,
      });
      
      expect(result).toBe('Optimized prompt result');
      expect(mockComplete).toHaveBeenCalledTimes(3); // Context inference + domain content + optimization
    });
  });
});
