/**
 * @test {PromptBuilderService}
 * @description Integration tests for context parameter passing to guidance services
 * 
 * Test Coverage:
 * - buildRewritePrompt with new context parameters
 * - Integration with VideoPromptService.getCategoryFocusGuidance
 * - Integration with BrainstormContextBuilder
 * - Context parameter pass-through
 * - Formatted guidance inclusion in final prompts
 * 
 * Pattern: Integration test with mocked dependencies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptBuilderService } from '../services/SystemPromptBuilder.js';

describe('PromptBuilderService - Integration Tests', () => {
  let service;
  let mockBrainstormBuilder;
  let mockVideoService;

  beforeEach(() => {
    // Mock BrainstormContextBuilder
    mockBrainstormBuilder = {
      buildBrainstormContextSection: vi.fn(),
      buildBrainstormSignature: vi.fn()
    };

    // Mock VideoPromptService
    mockVideoService = {
      isVideoPrompt: vi.fn(),
      detectVideoPhraseRole: vi.fn(),
      getVideoReplacementConstraints: vi.fn(),
      countWords: vi.fn(),
      getCategoryFocusGuidance: vi.fn(),
      detectTargetModel: vi.fn(),
      detectPromptSection: vi.fn()
    };

    // Create service with mocked dependencies
    service = new PromptBuilderService(mockBrainstormBuilder, mockVideoService);
  });

  // ============================================
  // buildRewritePrompt - Context Parameter Passing
  // ============================================

  describe('buildRewritePrompt', () => {
    it('should pass full context to getCategoryFocusGuidance for video prompts', () => {
      // Arrange
      const params = {
        highlightedText: 'soft light from left',
        contextBefore: 'A golden hour scene with ',
        contextAfter: ' illuminating the subject',
        fullPrompt: 'A golden hour scene with soft light from left illuminating the subject',
        originalUserPrompt: 'golden hour scene',
        isVideoPrompt: true,
        brainstormContext: null,
        phraseRole: 'lighting',
        highlightWordCount: 4,
        videoConstraints: null,
        highlightedCategory: 'lighting',
        highlightedCategoryConfidence: 0.9,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [
          { category: 'lighting', text: 'golden hour' },
          { category: 'lighting', text: 'soft light from left' }
        ],
        nearbySpans: [
          { category: 'lighting', text: 'golden hour' }
        ],
        editHistory: [
          {
            category: 'lighting',
            original: 'harsh light',
            replacement: 'soft light',
            timestamp: Date.now()
          }
        ],
        modelTarget: 'sora',
        promptSection: 'main_prompt'
      };

      mockVideoService.isVideoPrompt.mockReturnValue(true);
      mockVideoService.countWords.mockReturnValue(4);
      mockVideoService.detectVideoPhraseRole.mockReturnValue('lighting');
      mockVideoService.getVideoReplacementConstraints.mockReturnValue({
        minWords: 3,
        maxWords: 8,
        maxSentences: 1
      });
      mockVideoService.getCategoryFocusGuidance.mockReturnValue([
        'Warm rim light to complement golden hour',
        'Maintain soft lighting consistency with edit history'
      ]);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act
      const prompt = service.buildRewritePrompt(params);

      // Assert
      expect(mockVideoService.getCategoryFocusGuidance).toHaveBeenCalledWith(
        'lighting',
        'lighting',
        params.fullPrompt,
        params.allLabeledSpans,
        params.editHistory
      );
      expect(prompt).toContain('Warm rim light');
      expect(prompt).toContain('Maintain soft lighting consistency');
    });

    it('should include brainstorm context with creative intent analysis', () => {
      // Arrange
      const params = {
        highlightedText: 'vintage diner',
        contextBefore: 'A ',
        contextAfter: ' scene',
        fullPrompt: 'A vintage diner scene',
        originalUserPrompt: 'vintage diner',
        isVideoPrompt: true,
        brainstormContext: {
          elements: {
            mood: 'nostalgic memory',
            setting: 'vintage 1950s diner'
          },
          metadata: {}
        },
        phraseRole: null,
        highlightWordCount: 2,
        videoConstraints: null,
        highlightedCategory: 'location',
        highlightedCategoryConfidence: 0.85,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockVideoService.countWords.mockReturnValue(2);
      mockVideoService.detectVideoPhraseRole.mockReturnValue('location');
      mockVideoService.getVideoReplacementConstraints.mockReturnValue({
        minWords: 2,
        maxWords: 6,
        maxSentences: 1
      });
      mockVideoService.getCategoryFocusGuidance.mockReturnValue(null);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue(
        '**Creative Brainstorm Structured Context:**\n' +
        '- Mood: nostalgic memory\n' +
        '- Setting: vintage 1950s diner\n\n' +
        '**Creative Intent Analysis:**\n' +
        'The elements suggest a "nostalgic narrative" direction.\n'
      );

      // Act
      const prompt = service.buildRewritePrompt(params);

      // Assert
      expect(mockBrainstormBuilder.buildBrainstormContextSection).toHaveBeenCalledWith(
        params.brainstormContext,
        expect.objectContaining({
          isVideoPrompt: true
        })
      );
      expect(prompt).toContain('Creative Brainstorm Structured Context');
      expect(prompt).toContain('nostalgic narrative');
    });

    it('should handle empty context parameters gracefully', () => {
      // Arrange
      const params = {
        highlightedText: 'scene',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'scene',
        originalUserPrompt: 'scene',
        isVideoPrompt: false,
        brainstormContext: null,
        phraseRole: null,
        highlightWordCount: 1,
        videoConstraints: null,
        highlightedCategory: null,
        highlightedCategoryConfidence: 0,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act & Assert - should not throw
      expect(() => {
        service.buildRewritePrompt(params);
      }).not.toThrow();
    });

    it('should not call video service methods for non-video prompts', () => {
      // Arrange
      const params = {
        highlightedText: 'text',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'text',
        originalUserPrompt: 'text',
        isVideoPrompt: false,
        brainstormContext: null,
        phraseRole: null,
        highlightWordCount: 1,
        videoConstraints: null,
        highlightedCategory: null,
        highlightedCategoryConfidence: 0,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act
      service.buildRewritePrompt(params);

      // Assert
      expect(mockVideoService.getCategoryFocusGuidance).not.toHaveBeenCalled();
      expect(mockVideoService.detectVideoPhraseRole).not.toHaveBeenCalled();
    });

    it('should include model and section context when provided', () => {
      // Arrange
      const params = {
        highlightedText: 'realistic physics',
        contextBefore: 'A scene with ',
        contextAfter: ' and continuous action',
        fullPrompt: 'A scene with realistic physics and continuous action for Sora',
        originalUserPrompt: 'realistic scene',
        isVideoPrompt: true,
        brainstormContext: null,
        phraseRole: 'action',
        highlightWordCount: 2,
        videoConstraints: null,
        highlightedCategory: 'action',
        highlightedCategoryConfidence: 0.9,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
        modelTarget: 'sora',
        promptSection: 'main_prompt'
      };

      mockVideoService.countWords.mockReturnValue(2);
      mockVideoService.detectVideoPhraseRole.mockReturnValue('action');
      mockVideoService.getVideoReplacementConstraints.mockReturnValue({
        minWords: 2,
        maxWords: 6,
        maxSentences: 1
      });
      mockVideoService.getCategoryFocusGuidance.mockReturnValue(null);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act
      const prompt = service.buildRewritePrompt(params);

      // Assert - model and section info should appear somewhere in the prompt (case-insensitive)
      expect(prompt.toLowerCase()).toContain('sora');
      expect(prompt).toContain('realistic');
    });
  });

  // ============================================
  // buildPlaceholderPrompt - Context Parameter Passing
  // ============================================

  describe('buildPlaceholderPrompt', () => {
    it('should pass context parameters for video prompts', () => {
      // Arrange
      const params = {
        highlightedText: '[lighting]',
        placeholderType: 'lighting',
        contextBefore: 'A scene with ',
        contextAfter: ' during golden hour',
        fullPrompt: 'A scene with [lighting] during golden hour',
        originalUserPrompt: 'scene with lighting',
        isVideoPrompt: true,
        brainstormContext: null,
        highlightedCategory: 'lighting',
        videoConstraints: null,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [
          { category: 'time', text: 'golden hour' }
        ],
        nearbySpans: [
          { category: 'time', text: 'golden hour' }
        ],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockVideoService.isVideoPrompt.mockReturnValue(true);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act
      const prompt = service.buildPlaceholderPrompt(params);

      // Assert
      expect(prompt).toBeDefined();
      expect(prompt).toContain('lighting');
      expect(prompt).toContain('golden hour');
    });

    it('should include brainstorm context in placeholder prompts', () => {
      // Arrange
      const params = {
        highlightedText: '[setting]',
        placeholderType: 'setting',
        contextBefore: 'A ',
        contextAfter: '',
        fullPrompt: 'A [setting]',
        originalUserPrompt: 'setting',
        isVideoPrompt: true,
        brainstormContext: {
          elements: {
            mood: 'futuristic',
            style: 'sci-fi neon'
          },
          metadata: {}
        },
        highlightedCategory: 'location',
        videoConstraints: null,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockVideoService.isVideoPrompt.mockReturnValue(true);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue(
        '**Creative Brainstorm Structured Context:**\n' +
        '- Mood: futuristic\n' +
        '- Style: sci-fi neon\n\n' +
        '**Creative Intent Analysis:**\n' +
        'The elements suggest a "futuristic vision" direction.\n'
      );

      // Act
      const prompt = service.buildPlaceholderPrompt(params);

      // Assert
      expect(mockBrainstormBuilder.buildBrainstormContextSection).toHaveBeenCalled();
      expect(prompt).toContain('futuristic');
      expect(prompt).toContain('sci-fi neon');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle null videoService gracefully', () => {
      // Arrange
      service = new PromptBuilderService(mockBrainstormBuilder, null);
      const params = {
        highlightedText: 'text',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'text',
        originalUserPrompt: 'text',
        isVideoPrompt: false,
        brainstormContext: null,
        phraseRole: null,
        highlightWordCount: 1,
        videoConstraints: null,
        highlightedCategory: null,
        highlightedCategoryConfidence: 0,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act & Assert - should not throw
      expect(() => {
        service.buildRewritePrompt(params);
      }).not.toThrow();
    });

    it('should handle very long allLabeledSpans arrays', () => {
      // Arrange
      const params = {
        highlightedText: 'light',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'light',
        originalUserPrompt: 'light',
        isVideoPrompt: true,
        brainstormContext: null,
        phraseRole: 'lighting',
        highlightWordCount: 1,
        videoConstraints: null,
        highlightedCategory: 'lighting',
        highlightedCategoryConfidence: 0.9,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: Array(100).fill(null).map((_, i) => ({
          category: 'lighting',
          text: `light ${i}`
        })),
        nearbySpans: [],
        editHistory: [],
        modelTarget: null,
        promptSection: null
      };

      mockVideoService.countWords.mockReturnValue(1);
      mockVideoService.detectVideoPhraseRole.mockReturnValue('lighting');
      mockVideoService.getVideoReplacementConstraints.mockReturnValue({
        minWords: 1,
        maxWords: 3,
        maxSentences: 1
      });
      mockVideoService.getCategoryFocusGuidance.mockReturnValue(null);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act
      const start = Date.now();
      service.buildRewritePrompt(params);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(100);
    });

    it('should handle large edit history arrays', () => {
      // Arrange
      const params = {
        highlightedText: 'light',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'light',
        originalUserPrompt: 'light',
        isVideoPrompt: true,
        brainstormContext: null,
        phraseRole: 'lighting',
        highlightWordCount: 1,
        videoConstraints: null,
        highlightedCategory: 'lighting',
        highlightedCategoryConfidence: 0.9,
        dependencyContext: null,
        elementDependencies: null,
        allLabeledSpans: [],
        nearbySpans: [],
        editHistory: Array(50).fill(null).map((_, i) => ({
          category: 'lighting',
          original: `old ${i}`,
          replacement: `new ${i}`,
          timestamp: Date.now() - i * 1000
        })),
        modelTarget: null,
        promptSection: null
      };

      mockVideoService.countWords.mockReturnValue(1);
      mockVideoService.detectVideoPhraseRole.mockReturnValue('lighting');
      mockVideoService.getVideoReplacementConstraints.mockReturnValue({
        minWords: 1,
        maxWords: 3,
        maxSentences: 1
      });
      mockVideoService.getCategoryFocusGuidance.mockReturnValue(null);
      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act & Assert - should not throw
      expect(() => {
        service.buildRewritePrompt(params);
      }).not.toThrow();
    });
  });

  // ============================================
  // Backward Compatibility
  // ============================================

  describe('Backward Compatibility', () => {
    it('should work with old signature without new context params', () => {
      // Arrange
      const params = {
        highlightedText: 'light',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'light',
        originalUserPrompt: 'light',
        isVideoPrompt: false,
        brainstormContext: null,
        phraseRole: null,
        highlightWordCount: 1,
        videoConstraints: null,
        highlightedCategory: null,
        highlightedCategoryConfidence: 0,
        dependencyContext: null,
        elementDependencies: null
        // Missing: allLabeledSpans, nearbySpans, editHistory, modelTarget, promptSection
      };

      mockBrainstormBuilder.buildBrainstormContextSection.mockReturnValue('');

      // Act & Assert - should not throw
      expect(() => {
        service.buildRewritePrompt(params);
      }).not.toThrow();
    });
  });
});

