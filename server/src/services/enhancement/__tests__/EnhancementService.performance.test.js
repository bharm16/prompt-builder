import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock cache service at top level before imports
vi.mock('../../cache/CacheService.js', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({ ttl: 3600, namespace: 'enhancement' }),
    generateKey: vi.fn().mockReturnValue('cache-key'),
  },
}));

// Mock StructuredOutputEnforcer
vi.mock('../../../utils/StructuredOutputEnforcer.js', () => ({
  StructuredOutputEnforcer: {
    enforceJSON: vi.fn().mockResolvedValue([
      { value: 'suggestion 1', category: 'lighting' },
      { value: 'suggestion 2', category: 'lighting' },
    ]),
  },
}));

import { EnhancementService } from '../EnhancementService.js';

/**
 * Performance Monitoring Tests for EnhancementService
 * 
 * Tests the metrics tracking, timing, and performance monitoring
 * functionality added to the EnhancementService.
 */
describe('EnhancementService - Performance Monitoring', () => {
  let enhancementService;
  let mockAIService;
  let mockPlaceholderDetector;
  let mockVideoService;
  let mockBrainstormBuilder;
  let mockPromptBuilder;
  let mockValidationService;
  let mockDiversityEnforcer;
  let mockCategoryAligner;
  let mockMetricsService;
  let consoleSpy;

  beforeEach(() => {
    // Mock all dependencies
    mockAIService = {
      execute: vi.fn().mockResolvedValue({
        content: [{ text: 'mocked response' }]
      }),
      stream: vi.fn(),
      listOperations: vi.fn(),
      supportsStreaming: vi.fn(),
    };

    mockPlaceholderDetector = {
      detectPlaceholder: vi.fn().mockReturnValue(false),
    };

    mockVideoService = {
      isVideoPrompt: vi.fn().mockReturnValue(true),
      countWords: vi.fn().mockReturnValue(5),
      detectVideoPhraseRole: vi.fn().mockReturnValue('creative'),
      getVideoReplacementConstraints: vi.fn().mockReturnValue({ mode: 'standard' }),
      detectTargetModel: vi.fn().mockReturnValue('sora'),
      detectPromptSection: vi.fn().mockReturnValue('main_prompt'),
    };

    mockBrainstormBuilder = {
      buildBrainstormSignature: vi.fn().mockReturnValue('signature'),
    };

    mockPromptBuilder = {
      buildPrompt: vi.fn().mockReturnValue('prompt'),
      buildPlaceholderPrompt: vi.fn().mockReturnValue('prompt'),
      buildRewritePrompt: vi.fn().mockReturnValue('prompt'),
    };

    mockValidationService = {
      sanitizeSuggestions: vi.fn().mockReturnValue([
        { value: 'suggestion 1', category: 'lighting' },
        { value: 'suggestion 2', category: 'lighting' },
      ]),
    };

    mockDiversityEnforcer = {
      ensureDiverseSuggestions: vi.fn().mockResolvedValue([
        { value: 'suggestion 1', category: 'lighting' },
        { value: 'suggestion 2', category: 'lighting' },
      ]),
    };

    mockCategoryAligner = {
      enforceCategoryAlignment: vi.fn().mockReturnValue({
        suggestions: [
          { value: 'suggestion 1', category: 'lighting' },
          { value: 'suggestion 2', category: 'lighting' },
        ],
        fallbackApplied: false,
        context: {},
      }),
    };

    mockMetricsService = {
      recordEnhancementTiming: vi.fn(),
      recordAlert: vi.fn(),
    };

    // Spy on console.log for development mode testing
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create service with mocked metrics service
    enhancementService = new EnhancementService(
      mockAIService,
      mockPlaceholderDetector,
      mockVideoService,
      mockBrainstormBuilder,
      mockPromptBuilder,
      mockValidationService,
      mockDiversityEnforcer,
      mockCategoryAligner,
      mockMetricsService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Metrics Tracking', () => {
    it('should track metrics for cache hit', async () => {
      // Mock cache to return a hit
      const { cacheService } = await import('../../cache/CacheService.js');
      cacheService.get.mockResolvedValueOnce({ suggestions: [] });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: {},
        highlightedCategory: 'lighting',
      });

      // Verify metrics were logged (cache hit should have minimal timing)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Enhancement Service Performance')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache: HIT')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should track all timing metrics for cache miss', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockVideoService.detectTargetModel.mockImplementation(() => {
        const start = Date.now();
        while (Date.now() - start < 5) {
          // busy wait to register timing
        }
        return 'sora';
      });

      mockVideoService.detectPromptSection.mockImplementation(() => {
        const start = Date.now();
        while (Date.now() - start < 5) {
          // busy wait to register timing
        }
        return 'main_prompt';
      });

      mockPromptBuilder.buildPrompt.mockImplementation(() => {
        const start = Date.now();
        while (Date.now() - start < 5) {
          // busy wait to register timing
        }
        return 'prompt';
      });

      mockDiversityEnforcer.ensureDiverseSuggestions.mockImplementation(
        (suggestions) =>
          new Promise((resolve) =>
            setTimeout(() => resolve(suggestions), 5)
          )
      );

      const { StructuredOutputEnforcer } = await import(
        '../../../utils/StructuredOutputEnforcer.js'
      );
      StructuredOutputEnforcer.enforceJSON.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve([
                  { value: 'suggestion 1', category: 'lighting' },
                  { value: 'suggestion 2', category: 'lighting' },
                ]),
              5
            )
          )
      );

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: { elements: { time: 'golden hour' } },
        highlightedCategory: 'lighting',
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
      });

      // Verify all timing sections are logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Enhancement Service Performance')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache: MISS')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Model Detection:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Section Detection:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Prompt Build:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Groq Call:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Post-Processing:')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should send metrics to metricsService in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: { elements: { time: 'golden hour' } },
        highlightedCategory: 'lighting',
      });

      // Verify metricsService was called
      expect(mockMetricsService.recordEnhancementTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          total: expect.any(Number),
          cache: false,
          cacheCheck: expect.any(Number),
          modelDetection: expect.any(Number),
          sectionDetection: expect.any(Number),
          promptBuild: expect.any(Number),
          groqCall: expect.any(Number),
          postProcessing: expect.any(Number),
        }),
        expect.objectContaining({
          category: 'lighting',
          isVideo: true,
          modelTarget: 'sora',
          promptSection: 'main_prompt',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT log to console in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      consoleSpy.mockClear();

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: {},
        highlightedCategory: 'lighting',
      });

      // Verify console.log was NOT called with performance output
      const perfLogs = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Enhancement Service Performance')
      );
      expect(perfLogs.length).toBe(0);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Latency Threshold Alerts', () => {
    it('should alert when request exceeds 2000ms threshold', async () => {
      // Mock slow operations
      const { StructuredOutputEnforcer } = await import(
        '../../../utils/StructuredOutputEnforcer.js'
      );
      StructuredOutputEnforcer.enforceJSON.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve([
                  { value: 'suggestion 1', category: 'lighting' },
                  { value: 'suggestion 2', category: 'lighting' },
                ]),
              2100
            )
          )
      );

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: {},
        highlightedCategory: 'lighting',
      });

      // Verify alert was recorded
      expect(mockMetricsService.recordAlert).toHaveBeenCalledWith(
        'enhancement_latency_exceeded',
        expect.objectContaining({
          total: expect.any(Number),
          threshold: 2000,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT alert when request is under 2000ms', async () => {
      // Mock fast operations
      const { StructuredOutputEnforcer } = await import(
        '../../../utils/StructuredOutputEnforcer.js'
      );
      StructuredOutputEnforcer.enforceJSON.mockResolvedValue([
        { value: 'suggestion 1', category: 'lighting' },
        { value: 'suggestion 2', category: 'lighting' },
      ]);

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: {},
        highlightedCategory: 'lighting',
      });

      // Verify alert was NOT recorded
      expect(mockMetricsService.recordAlert).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling with Metrics', () => {
    it('should track metrics even when request fails', async () => {
      // Mock error in Groq call
      const { StructuredOutputEnforcer } = await import(
        '../../../utils/StructuredOutputEnforcer.js'
      );
      StructuredOutputEnforcer.enforceJSON.mockRejectedValue(
        new Error('API Error')
      );

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(
        enhancementService.getEnhancementSuggestions({
          highlightedText: 'golden hour',
          contextBefore: 'A scene with',
          contextAfter: 'lighting',
          fullPrompt: 'A scene with golden hour lighting',
          originalUserPrompt: 'A scene',
          brainstormContext: {},
          highlightedCategory: 'lighting',
        })
      ).rejects.toThrow('API Error');

      // Verify metrics were still recorded with error
      expect(mockMetricsService.recordEnhancementTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          total: expect.any(Number),
        }),
        expect.objectContaining({
          error: 'API Error',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Individual Operation Timing', () => {
    it('should track model detection timing', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockVideoService.detectTargetModel.mockImplementation(() => {
        // Simulate some processing time
        const start = Date.now();
        while (Date.now() - start < 10) {
          // busy wait
        }
        return 'sora';
      });

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: {},
        highlightedCategory: 'lighting',
      });

      // Verify model detection was timed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Model Detection:')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should track prompt build timing', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockPromptBuilder.buildPrompt.mockImplementation(() => {
        const start = Date.now();
        while (Date.now() - start < 5) {
          // busy wait
        }
        return 'prompt';
      });

      await enhancementService.getEnhancementSuggestions({
        highlightedText: 'golden hour',
        contextBefore: 'A scene with',
        contextAfter: 'lighting',
        fullPrompt: 'A scene with golden hour lighting',
        originalUserPrompt: 'A scene',
        brainstormContext: { elements: { time: 'golden hour', location: 'beach' } },
        highlightedCategory: 'lighting',
      });

      // Verify prompt build was timed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Prompt Build:')
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});
