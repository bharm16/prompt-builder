import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EnhancementService } from '../../../../server/src/services/EnhancementService.js';
import { logger } from '../../../../server/src/infrastructure/Logger.js';
import { cacheService } from '../../../../server/src/services/CacheService.js';
import { StructuredOutputEnforcer } from '../../../../server/src/utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../../../../server/src/utils/TemperatureOptimizer.js';
import * as DescriptorCategories from '../../../../server/src/services/video-concept/SubjectDescriptorCategories.js';

// Mock external dependencies
vi.mock('../../../../server/src/infrastructure/Logger.js');
vi.mock('../../../../server/src/services/CacheService.js');
vi.mock('../../../../server/src/utils/StructuredOutputEnforcer.js');
vi.mock('../../../../server/src/utils/TemperatureOptimizer.js');
vi.mock('../../../../server/src/services/video-concept/SubjectDescriptorCategories.js');

describe('EnhancementService', () => {
  let service;
  let mockClaudeClient;
  let mockGroqClient;
  let mockPlaceholderDetector;
  let mockVideoService;
  let mockBrainstormBuilder;
  let mockPromptBuilder;
  let mockValidationService;
  let mockDiversityEnforcer;
  let mockCategoryAligner;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock dependencies
    mockClaudeClient = {
      complete: vi.fn(),
    };

    mockGroqClient = {
      complete: vi.fn(),
    };

    mockPlaceholderDetector = {
      detectPlaceholder: vi.fn(),
    };

    mockVideoService = {
      isVideoPrompt: vi.fn(),
      countWords: vi.fn(),
      detectVideoPhraseRole: vi.fn(),
      getVideoReplacementConstraints: vi.fn(),
      getVideoFallbackConstraints: vi.fn(),
    };

    mockBrainstormBuilder = {
      buildBrainstormSignature: vi.fn(),
    };

    mockPromptBuilder = {
      buildPlaceholderPrompt: vi.fn(),
      buildRewritePrompt: vi.fn(),
      buildCustomPrompt: vi.fn(),
    };

    mockValidationService = {
      sanitizeSuggestions: vi.fn(),
      groupSuggestionsByCategory: vi.fn(),
    };

    mockDiversityEnforcer = {
      ensureDiverseSuggestions: vi.fn(),
    };

    mockCategoryAligner = {
      enforceCategoryAlignment: vi.fn(),
    };

    // Setup cache service mock
    cacheService.getConfig = vi.fn().mockReturnValue({
      namespace: 'enhancement',
      ttl: 3600,
    });
    cacheService.generateKey = vi.fn().mockReturnValue('mock-cache-key');
    cacheService.get = vi.fn().mockResolvedValue(null);
    cacheService.set = vi.fn().mockResolvedValue(undefined);

    // Setup temperature optimizer mock
    TemperatureOptimizer.getOptimalTemperature = vi.fn().mockReturnValue(0.7);

    // Setup descriptor categories mock
    DescriptorCategories.detectDescriptorCategory = vi.fn().mockReturnValue({
      category: null,
      confidence: 0,
    });
    DescriptorCategories.getCategoryFallbacks = vi.fn().mockReturnValue([]);

    // Create service instance
    service = new EnhancementService(
      mockClaudeClient,
      mockGroqClient,
      mockPlaceholderDetector,
      mockVideoService,
      mockBrainstormBuilder,
      mockPromptBuilder,
      mockValidationService,
      mockDiversityEnforcer,
      mockCategoryAligner
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEnhancementSuggestions', () => {
    describe('Cache Behavior', () => {
      it('should return cached result when cache hit occurs', async () => {
        const cachedResult = {
          suggestions: [{ text: 'cached suggestion' }],
          isPlaceholder: false,
        };
        cacheService.get.mockResolvedValue(cachedResult);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'test',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test prompt',
        });

        expect(result).toEqual(cachedResult);
        // Verify no downstream services were called
        expect(mockPlaceholderDetector.detectPlaceholder).not.toHaveBeenCalled();
        expect(StructuredOutputEnforcer.enforceJSON).not.toHaveBeenCalled();
      });

      it('should generate and cache result when cache miss occurs', async () => {
        cacheService.get.mockResolvedValue(null);
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion 1', explanation: 'exp 1' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'test',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test prompt',
        });

        expect(cacheService.set).toHaveBeenCalledWith(
          'mock-cache-key',
          expect.objectContaining({
            suggestions: mockSuggestions,
            isPlaceholder: false,
          }),
          { ttl: 3600 }
        );
        expect(result.suggestions).toEqual(mockSuggestions);
      });
    });

    describe('Placeholder vs Rewrite Logic', () => {
      it('should use placeholder prompt and include category in schema when placeholder detected', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(true);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildPlaceholderPrompt.mockReturnValue('placeholder prompt');

        const mockSuggestions = [
          { text: 'suggestion 1', explanation: 'exp 1', category: 'action' },
        ];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);
        mockValidationService.groupSuggestionsByCategory.mockReturnValue([
          { category: 'action', suggestions: mockSuggestions },
        ]);

        const result = await service.getEnhancementSuggestions({
          highlightedText: '[placeholder]',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test prompt',
        });

        // Verify placeholder prompt was used
        expect(mockPromptBuilder.buildPlaceholderPrompt).toHaveBeenCalled();
        expect(mockPromptBuilder.buildRewritePrompt).not.toHaveBeenCalled();

        // Verify schema included 'category' in required fields
        const schemaCall = StructuredOutputEnforcer.enforceJSON.mock.calls[0];
        expect(schemaCall[2].schema.items.required).toContain('category');

        // Verify result has correct structure
        expect(result.isPlaceholder).toBe(true);
        expect(result.hasCategories).toBe(true);
        expect(mockValidationService.groupSuggestionsByCategory).toHaveBeenCalled();
      });

      it('should use rewrite prompt and exclude category from schema when not placeholder', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(3);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('rewrite prompt');

        const mockSuggestions = [{ text: 'suggestion 1', explanation: 'exp 1' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'normal text',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test prompt',
        });

        // Verify rewrite prompt was used
        expect(mockPromptBuilder.buildRewritePrompt).toHaveBeenCalled();
        expect(mockPromptBuilder.buildPlaceholderPrompt).not.toHaveBeenCalled();

        // Verify schema did NOT include 'category' in required fields
        const schemaCall = StructuredOutputEnforcer.enforceJSON.mock.calls[0];
        expect(schemaCall[2].schema.items.required).not.toContain('category');

        // Verify result structure
        expect(result.isPlaceholder).toBe(false);
        expect(result.hasCategories).toBe(false);
        expect(mockValidationService.groupSuggestionsByCategory).not.toHaveBeenCalled();
      });
    });

    describe('Video Prompt Handling', () => {
      it('should detect video phrases and apply video constraints when video prompt detected', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('video prompt');

        const mockSuggestions = [{ text: 'dog', explanation: 'exp 1' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: 'A video of a ',
          contextAfter: ' playing',
          fullPrompt: 'Generate video: A video of a cat playing',
        });

        // Verify video detection chain was called
        expect(mockVideoService.detectVideoPhraseRole).toHaveBeenCalledWith(
          'cat',
          'A video of a ',
          ' playing',
          undefined
        );
        expect(mockVideoService.getVideoReplacementConstraints).toHaveBeenCalledWith({
          highlightWordCount: 2,
          phraseRole: 'subject',
          highlightedText: 'cat',
          highlightedCategory: undefined,
          highlightedCategoryConfidence: undefined,
        });

        // Verify constraints were passed to prompt builder
        expect(mockPromptBuilder.buildRewritePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            isVideoPrompt: true,
            phraseRole: 'subject',
            videoConstraints: { mode: 'strict', maxWords: 2 },
          })
        );

        // Verify result includes video metadata
        expect(result.phraseRole).toBe('subject');
        expect(result.appliedConstraintMode).toBe('strict');
        expect(result.appliedVideoConstraints).toEqual({ mode: 'strict', maxWords: 2 });
      });

      it('should not apply video logic when non-video prompt', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(3);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('normal prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'normal text',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Normal prompt',
        });

        // Verify video-specific methods were NOT called
        expect(mockVideoService.detectVideoPhraseRole).not.toHaveBeenCalled();
        expect(mockVideoService.getVideoReplacementConstraints).not.toHaveBeenCalled();

        // Verify prompt builder received null video params
        expect(mockPromptBuilder.buildRewritePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            isVideoPrompt: false,
            phraseRole: null,
            videoConstraints: null,
          })
        );

        // Verify result has null video metadata
        expect(result.phraseRole).toBe(null);
        expect(result.appliedVideoConstraints).toBeUndefined();
      });
    });

    describe('Fallback Regeneration Logic', () => {
      it('should NOT attempt fallback regeneration when suggestions exist after sanitization', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'dog', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: cat',
        });

        // Verify fallback was NOT triggered
        expect(mockVideoService.getVideoFallbackConstraints).not.toHaveBeenCalled();
        expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledTimes(1);
      });

      it('should attempt fallback regeneration when all suggestions removed during sanitization', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        // First call returns suggestions that get sanitized to empty
        const mockInitialSuggestions = [{ text: 'invalid three words', explanation: 'exp' }];
        // Second call (fallback) returns valid suggestions
        const mockFallbackSuggestions = [{ text: 'dog', explanation: 'exp' }];

        StructuredOutputEnforcer.enforceJSON
          .mockResolvedValueOnce(mockInitialSuggestions)
          .mockResolvedValueOnce(mockFallbackSuggestions);

        mockDiversityEnforcer.ensureDiverseSuggestions
          .mockResolvedValueOnce(mockInitialSuggestions)
          .mockResolvedValueOnce(mockFallbackSuggestions);

        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockInitialSuggestions,
          fallbackApplied: false,
          context: {},
        });

        // First sanitization returns empty, second returns valid
        mockValidationService.sanitizeSuggestions
          .mockReturnValueOnce([])
          .mockReturnValueOnce(mockFallbackSuggestions);

        // Setup fallback constraints
        mockVideoService.getVideoFallbackConstraints.mockReturnValueOnce({
          mode: 'relaxed',
          maxWords: 3,
        }).mockReturnValueOnce(null); // End the loop

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: cat',
        });

        // Verify fallback logic was triggered
        expect(mockVideoService.getVideoFallbackConstraints).toHaveBeenCalledWith(
          { mode: 'strict', maxWords: 2 },
          expect.objectContaining({
            highlightWordCount: 2,
            phraseRole: 'subject',
          }),
          expect.any(Set)
        );

        // Verify second prompt generation with fallback constraints
        expect(mockPromptBuilder.buildRewritePrompt).toHaveBeenCalledTimes(2);
        expect(mockPromptBuilder.buildRewritePrompt).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            videoConstraints: { mode: 'relaxed', maxWords: 3 },
          })
        );

        // Verify result uses fallback suggestions
        expect(result.suggestions).toEqual(mockFallbackSuggestions);
        expect(result.fallbackApplied).toBe(true);
        expect(result.appliedConstraintMode).toBe('relaxed');
      });

      it('should try multiple fallback attempts until one succeeds', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        // Setup: initial + 2 failed fallbacks + 1 successful fallback
        const mockInitialSuggestions = [{ text: 'invalid', explanation: 'exp' }];
        const mockFallback1 = [{ text: 'also invalid', explanation: 'exp' }];
        const mockFallback2 = [{ text: 'still invalid', explanation: 'exp' }];
        const mockFallback3 = [{ text: 'valid', explanation: 'exp' }];

        StructuredOutputEnforcer.enforceJSON
          .mockResolvedValueOnce(mockInitialSuggestions)
          .mockResolvedValueOnce(mockFallback1)
          .mockResolvedValueOnce(mockFallback2)
          .mockResolvedValueOnce(mockFallback3);

        mockDiversityEnforcer.ensureDiverseSuggestions
          .mockResolvedValueOnce(mockInitialSuggestions)
          .mockResolvedValueOnce(mockFallback1)
          .mockResolvedValueOnce(mockFallback2)
          .mockResolvedValueOnce(mockFallback3);

        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockInitialSuggestions,
          fallbackApplied: false,
          context: {},
        });

        // All sanitizations return empty except the last one
        mockValidationService.sanitizeSuggestions
          .mockReturnValueOnce([])
          .mockReturnValueOnce([])
          .mockReturnValueOnce([])
          .mockReturnValueOnce(mockFallback3);

        // Setup fallback constraint chain
        mockVideoService.getVideoFallbackConstraints
          .mockReturnValueOnce({ mode: 'relaxed', maxWords: 3 })
          .mockReturnValueOnce({ mode: 'loose', maxWords: 4 })
          .mockReturnValueOnce({ mode: 'any', maxWords: 5 })
          .mockReturnValueOnce(null); // End the loop

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: cat',
        });

        // Verify multiple fallback attempts
        // Initial call (1) + 2 failed attempts that call again (2,3) = 3 total
        expect(mockVideoService.getVideoFallbackConstraints).toHaveBeenCalledTimes(3);
        expect(mockPromptBuilder.buildRewritePrompt).toHaveBeenCalledTimes(4);

        // Verify final result uses the successful fallback
        expect(result.suggestions).toEqual(mockFallback3);
        expect(result.fallbackApplied).toBe(true);
        expect(result.appliedConstraintMode).toBe('any');
      });

      it('should stop fallback attempts when no more fallback constraints available', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'invalid', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue([]);

        // Setup: first fallback returns null (no more fallbacks)
        mockVideoService.getVideoFallbackConstraints.mockReturnValue(null);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: cat',
        });

        // Verify loop terminated after checking for fallback
        expect(mockVideoService.getVideoFallbackConstraints).toHaveBeenCalledTimes(1);
        // Only initial call, no fallback regenerations
        expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledTimes(1);

        // Result should have empty suggestions
        expect(result.suggestions).toEqual([]);
        expect(result.noSuggestionsReason).toBeDefined();
      });

      it('should NOT attempt fallback regeneration for placeholder prompts', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(true);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildPlaceholderPrompt.mockReturnValue('placeholder prompt');

        const mockSuggestions = [{ text: 'invalid', explanation: 'exp', category: 'action' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        // Sanitization removes all suggestions
        mockValidationService.sanitizeSuggestions.mockReturnValue([]);
        mockValidationService.groupSuggestionsByCategory.mockReturnValue([]);

        await service.getEnhancementSuggestions({
          highlightedText: '[placeholder]',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: [placeholder]',
        });

        // Verify fallback was NOT attempted (condition checks !isPlaceholder)
        expect(mockVideoService.getVideoFallbackConstraints).not.toHaveBeenCalled();
      });

      it('should handle errors during fallback regeneration gracefully', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockInitialSuggestions = [{ text: 'invalid', explanation: 'exp' }];

        // First call succeeds, second call (fallback) throws error, third call succeeds
        StructuredOutputEnforcer.enforceJSON
          .mockResolvedValueOnce(mockInitialSuggestions)
          .mockRejectedValueOnce(new Error('API Error'))
          .mockResolvedValueOnce([{ text: 'valid', explanation: 'exp' }]);

        mockDiversityEnforcer.ensureDiverseSuggestions
          .mockResolvedValueOnce(mockInitialSuggestions)
          .mockResolvedValueOnce([{ text: 'valid', explanation: 'exp' }]);

        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockInitialSuggestions,
          fallbackApplied: false,
          context: {},
        });

        mockValidationService.sanitizeSuggestions
          .mockReturnValueOnce([])
          .mockReturnValueOnce([{ text: 'valid', explanation: 'exp' }]);

        // Setup fallback constraints
        mockVideoService.getVideoFallbackConstraints
          .mockReturnValueOnce({ mode: 'relaxed', maxWords: 3 })
          .mockReturnValueOnce({ mode: 'loose', maxWords: 4 })
          .mockReturnValueOnce(null);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: cat',
        });

        // Verify error was logged but execution continued
        expect(logger.warn).toHaveBeenCalledWith(
          'Fallback regeneration failed',
          expect.objectContaining({
            mode: 'relaxed',
            error: 'API Error',
          })
        );

        // Verify next fallback was attempted
        // Initial call (1) + 1 attempt after error (2) = 2 total
        expect(mockVideoService.getVideoFallbackConstraints).toHaveBeenCalledTimes(2);
        expect(result.suggestions).toEqual([{ text: 'valid', explanation: 'exp' }]);
      });
    });

    describe('Descriptor Fallback Logic', () => {
      it('should apply descriptor fallbacks when suggestions empty and descriptor detected', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        StructuredOutputEnforcer.enforceJSON.mockResolvedValue([]);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue([]);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: [],
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue([]);

        // Setup descriptor detection
        DescriptorCategories.detectDescriptorCategory.mockReturnValue({
          category: 'mood',
          confidence: 0.8,
        });
        DescriptorCategories.getCategoryFallbacks.mockReturnValue([
          { text: 'happy', explanation: 'fallback 1' },
          { text: 'cheerful', explanation: 'fallback 2' },
        ]);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'joyful',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'A joyful scene',
        });

        // Verify descriptor fallbacks were used
        expect(DescriptorCategories.getCategoryFallbacks).toHaveBeenCalledWith('mood');
        expect(result.suggestions).toEqual([
          { text: 'happy', explanation: 'fallback 1' },
          { text: 'cheerful', explanation: 'fallback 2' },
        ]);
        expect(result.fallbackApplied).toBe(true);
      });

      it('should NOT apply descriptor fallbacks when confidence too low', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        StructuredOutputEnforcer.enforceJSON.mockResolvedValue([]);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue([]);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: [],
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue([]);

        // Setup descriptor detection with low confidence
        DescriptorCategories.detectDescriptorCategory.mockReturnValue({
          category: 'mood',
          confidence: 0.3, // Below 0.4 threshold
        });

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'something',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'something',
        });

        // Verify descriptor fallbacks were NOT attempted
        expect(DescriptorCategories.getCategoryFallbacks).not.toHaveBeenCalled();
        expect(result.suggestions).toEqual([]);
        expect(result.noSuggestionsReason).toBeDefined();
      });

      it('should NOT apply descriptor fallbacks when suggestions exist', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        DescriptorCategories.detectDescriptorCategory.mockReturnValue({
          category: 'mood',
          confidence: 0.8,
        });

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'joyful',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'A joyful scene',
        });

        // Verify descriptor fallbacks were NOT used when suggestions exist
        expect(DescriptorCategories.getCategoryFallbacks).not.toHaveBeenCalled();
        expect(result.suggestions).toEqual(mockSuggestions);
      });
    });

    describe('Category Alignment', () => {
      it('should enforce category alignment when highlightedCategory provided', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        const alignedSuggestions = [{ text: 'aligned', explanation: 'aligned exp' }];

        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: alignedSuggestions,
          fallbackApplied: true,
          context: { reason: 'category mismatch' },
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(alignedSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'test',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test',
          highlightedCategory: 'action',
          highlightedCategoryConfidence: 0.9,
        });

        // Verify category alignment was called with correct params
        expect(mockCategoryAligner.enforceCategoryAlignment).toHaveBeenCalledWith(
          mockSuggestions,
          {
            highlightedText: 'test',
            highlightedCategory: 'action',
            highlightedCategoryConfidence: 0.9,
          }
        );

        // Verify fallback logging occurred
        expect(logger.info).toHaveBeenCalledWith(
          'Applied category fallbacks',
          expect.objectContaining({
            category: 'action',
            reason: 'category mismatch',
          })
        );

        // Verify aligned suggestions were used
        expect(result.suggestions).toEqual(alignedSuggestions);
        expect(result.fallbackApplied).toBe(true);
      });

      it('should skip category alignment when highlightedCategory not provided', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        await service.getEnhancementSuggestions({
          highlightedText: 'test',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test',
        });

        // Verify category aligner was NOT called
        expect(mockCategoryAligner.enforceCategoryAlignment).not.toHaveBeenCalled();
      });
    });

    describe('Result Structure Assembly', () => {
      it('should include noSuggestionsReason when suggestions array is empty', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        StructuredOutputEnforcer.enforceJSON.mockResolvedValue([]);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue([]);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: [],
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue([]);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'test',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test',
        });

        expect(result.noSuggestionsReason).toBe(
          'No template-compliant drop-in replacements were generated for this highlight.'
        );
      });

      it('should NOT include noSuggestionsReason when suggestions exist', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(1);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'test',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'test',
        });

        expect(result.noSuggestionsReason).toBeUndefined();
      });

      it('should include appliedVideoConstraints only when video constraints exist', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(true);
        mockVideoService.countWords.mockReturnValue(2);
        mockVideoService.detectVideoPhraseRole.mockReturnValue('subject');
        mockVideoService.getVideoReplacementConstraints.mockReturnValue({
          mode: 'strict',
          maxWords: 2,
        });
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('signature');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'dog', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: 'cat',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: 'Generate video: cat',
        });

        expect(result.appliedVideoConstraints).toEqual({
          mode: 'strict',
          maxWords: 2,
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle null/undefined inputs gracefully', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(0);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: undefined,
          contextBefore: null,
          contextAfter: undefined,
          fullPrompt: 'test',
          originalUserPrompt: null,
          brainstormContext: undefined,
        });

        // Should complete without throwing
        expect(result.suggestions).toEqual(mockSuggestions);
      });

      it('should handle empty string inputs', async () => {
        mockPlaceholderDetector.detectPlaceholder.mockReturnValue(false);
        mockVideoService.isVideoPrompt.mockReturnValue(false);
        mockVideoService.countWords.mockReturnValue(0);
        mockBrainstormBuilder.buildBrainstormSignature.mockReturnValue('');
        mockPromptBuilder.buildRewritePrompt.mockReturnValue('prompt');

        const mockSuggestions = [{ text: 'suggestion', explanation: 'exp' }];
        StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
        mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);
        mockCategoryAligner.enforceCategoryAlignment.mockReturnValue({
          suggestions: mockSuggestions,
          fallbackApplied: false,
          context: {},
        });
        mockValidationService.sanitizeSuggestions.mockReturnValue(mockSuggestions);

        const result = await service.getEnhancementSuggestions({
          highlightedText: '',
          contextBefore: '',
          contextAfter: '',
          fullPrompt: '',
        });

        expect(result.suggestions).toEqual(mockSuggestions);
      });
    });
  });

  describe('getCustomSuggestions', () => {
    it('should return cached result when cache hit occurs', async () => {
      const cachedResult = { suggestions: [{ text: 'cached custom' }] };
      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.getCustomSuggestions({
        highlightedText: 'test',
        customRequest: 'make it funny',
        fullPrompt: 'test prompt',
      });

      expect(result).toEqual(cachedResult);
      expect(mockVideoService.isVideoPrompt).not.toHaveBeenCalled();
      expect(StructuredOutputEnforcer.enforceJSON).not.toHaveBeenCalled();
    });

    it('should generate custom suggestions and cache result', async () => {
      cacheService.get.mockResolvedValue(null);
      mockVideoService.isVideoPrompt.mockReturnValue(false);
      mockPromptBuilder.buildCustomPrompt.mockReturnValue('custom prompt');

      const mockSuggestions = [{ text: 'funny version' }];
      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
      mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);

      const result = await service.getCustomSuggestions({
        highlightedText: 'boring text',
        customRequest: 'make it funny',
        fullPrompt: 'test prompt',
      });

      expect(mockPromptBuilder.buildCustomPrompt).toHaveBeenCalledWith({
        highlightedText: 'boring text',
        customRequest: 'make it funny',
        fullPrompt: 'test prompt',
        isVideoPrompt: false,
      });

      expect(result.suggestions).toEqual(mockSuggestions);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should use correct schema without category requirement', async () => {
      cacheService.get.mockResolvedValue(null);
      mockVideoService.isVideoPrompt.mockReturnValue(false);
      mockPromptBuilder.buildCustomPrompt.mockReturnValue('prompt');

      const mockSuggestions = [{ text: 'suggestion' }];
      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
      mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);

      await service.getCustomSuggestions({
        highlightedText: 'test',
        customRequest: 'request',
        fullPrompt: 'prompt',
      });

      const schemaCall = StructuredOutputEnforcer.enforceJSON.mock.calls[0];
      expect(schemaCall[2].schema.items.required).toEqual(['text']);
      expect(schemaCall[2].schema.items.required).not.toContain('explanation');
      expect(schemaCall[2].schema.items.required).not.toContain('category');
    });

    it('should detect video prompts for custom suggestions', async () => {
      cacheService.get.mockResolvedValue(null);
      mockVideoService.isVideoPrompt.mockReturnValue(true);
      mockPromptBuilder.buildCustomPrompt.mockReturnValue('video custom prompt');

      const mockSuggestions = [{ text: 'video suggestion' }];
      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockSuggestions);
      mockDiversityEnforcer.ensureDiverseSuggestions.mockResolvedValue(mockSuggestions);

      await service.getCustomSuggestions({
        highlightedText: 'cat',
        customRequest: 'make it more dramatic',
        fullPrompt: 'Generate video: cat',
      });

      expect(mockPromptBuilder.buildCustomPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          isVideoPrompt: true,
        })
      );
    });
  });

  describe('transferStyle', () => {
    it('should transform text to technical style', async () => {
      const inputText = 'The program works well';
      const outputText = 'The application executes efficiently with optimal performance metrics';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: `  ${outputText}  ` }],
      });

      const result = await service.transferStyle(inputText, 'technical');

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        expect.stringContaining('Transform the following text to technical style'),
        expect.objectContaining({
          maxTokens: 1024,
          temperature: 0.7,
        })
      );

      expect(result).toBe(outputText);
    });

    it('should transform text to creative style', async () => {
      const inputText = 'It was a good day';
      const outputText = 'The sun danced across a canvas of endless possibilities';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: outputText }],
      });

      const result = await service.transferStyle(inputText, 'creative');

      const promptCall = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptCall).toContain('creative style');
      expect(promptCall).toContain('low'); // formality
      expect(promptCall).toContain('flowing'); // structure
      expect(result).toBe(outputText);
    });

    it('should transform text to academic style', async () => {
      const inputText = 'People think this is true';
      const outputText = 'Scholarly consensus suggests empirical evidence supports this hypothesis';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: outputText }],
      });

      const result = await service.transferStyle(inputText, 'academic');

      const promptCall = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptCall).toContain('academic style');
      expect(promptCall).toContain('scholarly'); // jargon
      expect(promptCall).toContain('argumentative'); // structure
      expect(result).toBe(outputText);
    });

    it('should transform text to casual style', async () => {
      const inputText = 'We must proceed with caution';
      const outputText = "Let's take it easy and be careful";

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: outputText }],
      });

      const result = await service.transferStyle(inputText, 'casual');

      const promptCall = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptCall).toContain('casual style');
      expect(promptCall).toContain('friendly'); // tone
      expect(result).toBe(outputText);
    });

    it('should transform text to formal style', async () => {
      const inputText = "Hey, that's not cool";
      const outputText = 'That behavior is unacceptable';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: outputText }],
      });

      const result = await service.transferStyle(inputText, 'formal');

      const promptCall = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptCall).toContain('formal style');
      expect(promptCall).toContain('respectful'); // tone
      expect(result).toBe(outputText);
    });

    it('should default to formal style for unknown style', async () => {
      const inputText = 'test text';
      const outputText = 'formal output';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: outputText }],
      });

      const result = await service.transferStyle(inputText, 'unknown-style');

      const promptCall = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptCall).toContain('unknown-style style');
      // Should use formal style config
      expect(promptCall).toContain('professional');
      expect(result).toBe(outputText);
    });

    it('should return original text when transformation fails', async () => {
      const inputText = 'original text';
      mockClaudeClient.complete.mockRejectedValue(new Error('API Error'));

      const result = await service.transferStyle(inputText, 'technical');

      expect(result).toBe(inputText);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to transfer style',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should trim whitespace from transformed text', async () => {
      const inputText = 'test';
      const outputTextWithWhitespace = '  \n\n  transformed text  \n  ';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: outputTextWithWhitespace }],
      });

      const result = await service.transferStyle(inputText, 'formal');

      expect(result).toBe('transformed text');
    });

    it('should preserve all style configuration options in prompt', async () => {
      const inputText = 'test';
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'output' }],
      });

      await service.transferStyle(inputText, 'technical');

      const promptCall = mockClaudeClient.complete.mock.calls[0][0];

      // Verify all configuration aspects are included
      expect(promptCall).toContain('Formality level:');
      expect(promptCall).toContain('Language type:');
      expect(promptCall).toContain('Structure:');
      expect(promptCall).toContain('Tone:');
      expect(promptCall).toContain('Examples style:');

      // Verify requirements are included
      expect(promptCall).toContain('Maintain all factual information');
      expect(promptCall).toContain('Adapt vocabulary');
      expect(promptCall).toContain('Restructure sentences');
      expect(promptCall).toContain('Preserve the core message');
    });
  });
});
