/**
 * @test {PromptOptimizationService}
 * @description Gold standard test example for backend services
 * 
 * This test demonstrates:
 * - Constructor dependency injection
 * - Comprehensive mocking without module-level mocks
 * - Clear AAA pattern
 * - Edge case coverage
 * - Error handling
 * - Async operation testing
 * - Cache behavior testing
 * 
 * Use this as the reference pattern for all backend service tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptOptimizationService } from '../prompt-optimization/PromptOptimizationService.js';

describe('PromptOptimizationService', () => {
  // ============================================
  // SETUP - Dependency Injection Pattern
  // ============================================
  
  let service;
  let mockClaudeClient;
  let mockGroqClient;
  let mockCacheService;
  let mockLogger;
  let mockTemplateService;
  let mockValidationService;
  let mockMetricsService;
  
  beforeEach(() => {
    // Create mocks for ALL injected dependencies
    mockClaudeClient = {
      complete: vi.fn(),
      completeStreaming: vi.fn(),
      validateConnection: vi.fn()
    };
    
    mockGroqClient = {
      complete: vi.fn(),
      isAvailable: vi.fn().mockReturnValue(true)
    };
    
    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      generateKey: vi.fn().mockImplementation((...args) => args.join(':')),
      getConfig: vi.fn().mockReturnValue({ ttl: 3600, namespace: 'optimization' })
    };
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    mockTemplateService = {
      load: vi.fn(),
      compile: vi.fn(),
      validate: vi.fn()
    };
    
    mockValidationService = {
      validatePrompt: vi.fn(),
      sanitizeOutput: vi.fn(),
      checkCompliance: vi.fn()
    };
    
    mockMetricsService = {
      recordLatency: vi.fn(),
      recordSuccess: vi.fn(),
      recordError: vi.fn()
    };
    
    // Inject all dependencies via constructor
    service = new PromptOptimizationService({
      claudeClient: mockClaudeClient,
      groqClient: mockGroqClient,
      cacheService: mockCacheService,
      logger: mockLogger,
      templateService: mockTemplateService,
      validationService: mockValidationService,
      metricsService: mockMetricsService
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });
  
  // ============================================
  // TEST SUITE - Constructor & Initialization
  // ============================================
  
  describe('Constructor', () => {
    it('should initialize with all required dependencies', () => {
      // Assert
      expect(service).toBeDefined();
      expect(service.claudeClient).toBe(mockClaudeClient);
      expect(service.groqClient).toBe(mockGroqClient);
      expect(service.cacheService).toBe(mockCacheService);
    });
    
    it('should throw error if required dependencies are missing', () => {
      // Act & Assert
      expect(() => new PromptOptimizationService({}))
        .toThrow('claudeClient is required');
      
      expect(() => new PromptOptimizationService({ 
        claudeClient: mockClaudeClient 
      }))
        .toThrow('cacheService is required');
    });
    
    it('should handle optional dependencies gracefully', () => {
      // Arrange
      const minimalService = new PromptOptimizationService({
        claudeClient: mockClaudeClient,
        cacheService: mockCacheService,
        logger: mockLogger,
        // groqClient is optional
        // metricsService is optional
      });
      
      // Assert
      expect(minimalService).toBeDefined();
      expect(minimalService.groqClient).toBeUndefined();
    });
  });
  
  // ============================================
  // TEST SUITE - optimize() Method
  // ============================================
  
  describe('optimize', () => {
    describe('Happy Path', () => {
      it('should return cached result when available', async () => {
        // Arrange
        const prompt = 'Test prompt for optimization';
        const cachedResult = {
          optimized: 'Cached optimized prompt',
          score: 95,
          metadata: { source: 'cache', timestamp: Date.now() }
        };
        mockCacheService.get.mockResolvedValue(cachedResult);
        
        // Act
        const result = await service.optimize(prompt);
        
        // Assert
        expect(result).toEqual(cachedResult);
        expect(mockCacheService.get).toHaveBeenCalledWith(
          'optimization:test-prompt-for-optimization:undefined:undefined'
        );
        expect(mockClaudeClient.complete).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Cache hit for prompt optimization'
        );
        expect(mockMetricsService.recordSuccess).toHaveBeenCalledWith(
          'optimization',
          expect.objectContaining({ source: 'cache' })
        );
      });
      
      it('should call Groq API when available and cache miss', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const groqResponse = {
          content: [{ text: 'Groq optimized: Test prompt with improvements' }]
        };
        
        mockCacheService.get.mockResolvedValue(null);
        mockGroqClient.isAvailable.mockReturnValue(true);
        mockGroqClient.complete.mockResolvedValue(groqResponse);
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        mockTemplateService.compile.mockReturnValue('System prompt template');
        
        // Act
        const result = await service.optimize(prompt);
        
        // Assert
        expect(mockGroqClient.complete).toHaveBeenCalledWith(
          'System prompt template',
          expect.objectContaining({
            maxTokens: expect.any(Number),
            temperature: expect.any(Number)
          })
        );
        expect(result.optimized).toBe('Groq optimized: Test prompt with improvements');
        expect(mockCacheService.set).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Optimization complete',
          expect.objectContaining({ provider: 'groq' })
        );
      });
      
      it('should fall back to Claude when Groq is unavailable', async () => {
        // Arrange
        const prompt = 'Test prompt';
        const claudeResponse = {
          content: [{ text: 'Claude optimized: Enhanced test prompt' }]
        };
        
        mockCacheService.get.mockResolvedValue(null);
        mockGroqClient.isAvailable.mockReturnValue(false);
        mockClaudeClient.complete.mockResolvedValue(claudeResponse);
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        mockTemplateService.compile.mockReturnValue('System prompt');
        
        // Act
        const result = await service.optimize(prompt);
        
        // Assert
        expect(mockGroqClient.complete).not.toHaveBeenCalled();
        expect(mockClaudeClient.complete).toHaveBeenCalled();
        expect(result.optimized).toBe('Claude optimized: Enhanced test prompt');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Optimization complete',
          expect.objectContaining({ provider: 'claude' })
        );
      });
      
      it('should handle context parameter correctly', async () => {
        // Arrange
        const prompt = 'Technical prompt';
        const context = {
          mode: 'technical',
          domain: 'software',
          audience: 'developers'
        };
        
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockResolvedValue({
          content: [{ text: 'Technical: Optimized prompt' }]
        });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        mockTemplateService.compile.mockImplementation((template, vars) => {
          expect(vars.context).toEqual(context);
          return 'Compiled with context';
        });
        
        // Act
        await service.optimize(prompt, context);
        
        // Assert
        expect(mockTemplateService.compile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ context })
        );
        expect(mockCacheService.generateKey).toHaveBeenCalledWith(
          'optimization',
          prompt,
          JSON.stringify(context),
          undefined
        );
      });
      
      it('should handle brainstormContext parameter', async () => {
        // Arrange
        const prompt = 'Video prompt';
        const brainstormContext = {
          elements: {
            subject: 'A cat',
            action: 'jumping',
            location: 'garden'
          },
          metadata: { format: 'video' }
        };
        
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockResolvedValue({
          content: [{ text: 'Video optimized prompt' }]
        });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        
        // Act
        await service.optimize(prompt, null, brainstormContext);
        
        // Assert
        expect(mockClaudeClient.complete).toHaveBeenCalledWith(
          expect.stringContaining('video'),
          expect.any(Object)
        );
        expect(mockCacheService.generateKey).toHaveBeenCalledWith(
          'optimization',
          prompt,
          undefined,
          JSON.stringify(brainstormContext)
        );
      });
    });
    
    describe('Error Handling', () => {
      it('should handle API errors gracefully', async () => {
        // Arrange
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockRejectedValue(new Error('API rate limit'));
        
        // Act & Assert
        await expect(service.optimize('Test'))
          .rejects.toThrow('API rate limit');
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Optimization failed',
          expect.objectContaining({ error: 'API rate limit' })
        );
        expect(mockMetricsService.recordError).toHaveBeenCalledWith(
          'optimization',
          expect.objectContaining({ error: 'API rate limit' })
        );
      });
      
      it('should retry on transient failures', async () => {
        // Arrange
        vi.useFakeTimers();
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({
            content: [{ text: 'Success after retry' }]
          });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        
        // Act
        const resultPromise = service.optimize('Test with retry');
        
        // Fast-forward through retry delay
        await vi.runAllTimersAsync();
        const result = await resultPromise;
        
        // Assert
        expect(result.optimized).toBe('Success after retry');
        expect(mockClaudeClient.complete).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Retrying optimization',
          expect.objectContaining({ attempt: 1 })
        );
        
        vi.useRealTimers();
      });
      
      it('should handle cache service errors without failing', async () => {
        // Arrange
        mockCacheService.get.mockRejectedValue(new Error('Redis connection lost'));
        mockClaudeClient.complete.mockResolvedValue({
          content: [{ text: 'Optimized without cache' }]
        });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        
        // Act
        const result = await service.optimize('Test');
        
        // Assert
        expect(result.optimized).toBe('Optimized without cache');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Cache retrieval failed',
          expect.objectContaining({ error: 'Redis connection lost' })
        );
        // Should continue without cache
        expect(mockClaudeClient.complete).toHaveBeenCalled();
      });
      
      it('should validate output and handle invalid responses', async () => {
        // Arrange
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockResolvedValue({
          content: [{ text: 'Invalid response with sensitive data' }]
        });
        mockValidationService.sanitizeOutput.mockReturnValue('Sanitized response');
        mockValidationService.checkCompliance.mockReturnValue({
          isValid: false,
          reason: 'Contains PII'
        });
        
        // Act
        const result = await service.optimize('Test');
        
        // Assert
        expect(result.optimized).toBe('Sanitized response');
        expect(mockValidationService.sanitizeOutput).toHaveBeenCalledWith(
          'Invalid response with sensitive data'
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Output compliance check failed',
          expect.objectContaining({ reason: 'Contains PII' })
        );
      });
    });
    
    describe('Edge Cases', () => {
      it('should handle empty prompt input', async () => {
        // Act & Assert
        await expect(service.optimize(''))
          .rejects.toThrow('Prompt cannot be empty');
        
        expect(mockClaudeClient.complete).not.toHaveBeenCalled();
      });
      
      it('should handle null prompt input', async () => {
        // Act & Assert
        await expect(service.optimize(null))
          .rejects.toThrow('Prompt is required');
      });
      
      it('should handle undefined prompt input', async () => {
        // Act & Assert
        await expect(service.optimize(undefined))
          .rejects.toThrow('Prompt is required');
      });
      
      it('should handle very long prompts', async () => {
        // Arrange
        const longPrompt = 'a'.repeat(10000);
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockResolvedValue({
          content: [{ text: 'Optimized long prompt' }]
        });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        
        // Act
        const result = await service.optimize(longPrompt);
        
        // Assert
        expect(result.optimized).toBe('Optimized long prompt');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Processing long prompt',
          expect.objectContaining({ length: 10000 })
        );
      });
      
      it('should handle special characters in prompts', async () => {
        // Arrange
        const specialPrompt = 'Test with "quotes" and \n newlines and émojis 🚀';
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockResolvedValue({
          content: [{ text: 'Handled special chars' }]
        });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        
        // Act
        const result = await service.optimize(specialPrompt);
        
        // Assert
        expect(result.optimized).toBe('Handled special chars');
        // Cache key should handle special chars
        expect(mockCacheService.generateKey).toHaveBeenCalledWith(
          'optimization',
          specialPrompt,
          undefined,
          undefined
        );
      });
      
      it('should handle concurrent optimization requests', async () => {
        // Arrange
        mockCacheService.get.mockResolvedValue(null);
        mockClaudeClient.complete.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { content: [{ text: 'Concurrent result' }] };
        });
        mockValidationService.sanitizeOutput.mockImplementation(text => text);
        
        // Act - Fire multiple concurrent requests
        const results = await Promise.all([
          service.optimize('Prompt 1'),
          service.optimize('Prompt 2'),
          service.optimize('Prompt 3')
        ]);
        
        // Assert
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.optimized).toBe('Concurrent result');
        });
        expect(mockClaudeClient.complete).toHaveBeenCalledTimes(3);
      });
    });
  });
  
  // ============================================
  // TEST SUITE - calculateQualityScore() Method
  // ============================================
  
  describe('calculateQualityScore', () => {
    it('should calculate score based on optimization improvements', () => {
      // Arrange
      const original = 'short prompt';
      const optimized = '**Goal**: Achieve specific outcome\n\n' +
                       '**Context**: Detailed background information\n\n' +
                       '**Requirements**: Clear specifications\n\n' +
                       '**Output Format**: Structured response';
      
      // Act
      const score = service.calculateQualityScore(original, optimized);
      
      // Assert
      expect(score).toBeGreaterThan(80);
      expect(score).toBeLessThanOrEqual(100);
    });
    
    it('should handle identical input and output', () => {
      // Arrange
      const text = 'Same text for both';
      
      // Act
      const score = service.calculateQualityScore(text, text);
      
      // Assert
      expect(score).toBe(50); // Baseline score for no improvement
    });
    
    it('should handle empty optimized output', () => {
      // Act
      const score = service.calculateQualityScore('Original', '');
      
      // Assert
      expect(score).toBe(0);
    });
  });
  
  // ============================================
  // TEST SUITE - Performance & Resource Management
  // ============================================
  
  describe('Performance', () => {
    it('should respect timeout configuration', async () => {
      // Arrange
      vi.useFakeTimers();
      mockCacheService.get.mockResolvedValue(null);
      mockClaudeClient.complete.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 60000))
      );
      
      // Act
      const promise = service.optimize('Test timeout');
      vi.advanceTimersByTime(30000); // Default timeout
      
      // Assert
      await expect(promise).rejects.toThrow('Optimization timeout');
      expect(mockMetricsService.recordError).toHaveBeenCalledWith(
        'optimization',
        expect.objectContaining({ error: 'timeout' })
      );
      
      vi.useRealTimers();
    });
    
    it('should track latency metrics', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Result' }]
      });
      mockValidationService.sanitizeOutput.mockImplementation(text => text);
      
      // Act
      await service.optimize('Test');
      
      // Assert
      expect(mockMetricsService.recordLatency).toHaveBeenCalledWith(
        'optimization',
        expect.any(Number)
      );
    });
    
    it('should clean up resources on service destruction', () => {
      // Act
      service.destroy();
      
      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Service destroyed');
      // Verify no memory leaks or hanging connections
      expect(service.claudeClient).toBeNull();
      expect(service.groqClient).toBeNull();
    });
  });
});
