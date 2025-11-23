/**
 * ContrastiveDiversityEnforcer Tests
 * 
 * Tests PDF Section 6.3 implementation: contrastive decoding with
 * negative constraints for enhanced diversity
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContrastiveDiversityEnforcer } from '../../../server/src/services/enhancement/services/ContrastiveDiversityEnforcer.js';

describe('ContrastiveDiversityEnforcer', () => {
  let enforcer;
  let mockAiService;

  beforeEach(() => {
    mockAiService = {
      execute: vi.fn(),
    };
    enforcer = new ContrastiveDiversityEnforcer(mockAiService);
  });

  describe('shouldUseContrastiveDecoding', () => {
    it('should return true for video prompts', () => {
      const context = {
        isVideoPrompt: true,
        highlightedText: 'A camera dolly shot',
      };
      
      expect(enforcer.shouldUseContrastiveDecoding(context)).toBe(true);
    });

    it('should return true for placeholders', () => {
      const context = {
        isPlaceholder: true,
        highlightedText: '[SUBJECT]',
      };
      
      expect(enforcer.shouldUseContrastiveDecoding(context)).toBe(true);
    });

    it('should return false for short text', () => {
      const context = {
        isVideoPrompt: false,
        isPlaceholder: false,
        highlightedText: 'short',
      };
      
      expect(enforcer.shouldUseContrastiveDecoding(context)).toBe(false);
    });

    it('should return false when disabled in config', () => {
      enforcer.config.enabled = false;
      
      const context = {
        isVideoPrompt: true,
        highlightedText: 'A camera dolly shot',
      };
      
      expect(enforcer.shouldUseContrastiveDecoding(context)).toBe(false);
    });
  });

  describe('_buildNegativeConstraint', () => {
    it('should build constraint from previous suggestions', () => {
      const previousSuggestions = [
        { text: 'wide shot' },
        { text: 'close-up' },
      ];
      
      const constraint = enforcer._buildNegativeConstraint(previousSuggestions);
      
      expect(constraint).toContain('wide shot');
      expect(constraint).toContain('close-up');
      expect(constraint).toContain('Do not use');
    });

    it('should return null for empty array', () => {
      expect(enforcer._buildNegativeConstraint([])).toBeNull();
    });

    it('should handle string suggestions', () => {
      const constraint = enforcer._buildNegativeConstraint(['test1', 'test2']);
      
      expect(constraint).toContain('test1');
      expect(constraint).toContain('test2');
    });
  });

  describe('calculateDiversityMetrics', () => {
    it('should calculate similarity metrics', () => {
      const suggestions = [
        { text: 'wide shot of city' },
        { text: 'close-up of face' },
        { text: 'aerial view of landscape' },
      ];
      
      const metrics = enforcer.calculateDiversityMetrics(suggestions);
      
      expect(metrics).toHaveProperty('avgSimilarity');
      expect(metrics).toHaveProperty('minSimilarity');
      expect(metrics).toHaveProperty('maxSimilarity');
      expect(metrics).toHaveProperty('pairCount');
      expect(metrics.pairCount).toBe(3); // 3 suggestions = 3 pairs
    });

    it('should return zeros for insufficient suggestions', () => {
      const metrics = enforcer.calculateDiversityMetrics([{ text: 'single' }]);
      
      expect(metrics.avgSimilarity).toBe(0);
    });

    it('should detect high similarity', () => {
      const suggestions = [
        { text: 'wide shot' },
        { text: 'wide angle shot' },
      ];
      
      const metrics = enforcer.calculateDiversityMetrics(suggestions);
      
      // Should have high similarity due to shared words
      expect(metrics.avgSimilarity).toBeGreaterThan(0.5);
    });
  });

  describe('_augmentPromptWithConstraint', () => {
    it('should inject constraint into prompt', () => {
      const basePrompt = 'Generate suggestions.\n\nBe creative.';
      const constraint = 'Avoid: wide shot, close-up';
      
      const augmented = enforcer._augmentPromptWithConstraint(basePrompt, constraint);
      
      expect(augmented).toContain(constraint);
      expect(augmented).toContain('CRITICAL DIVERSITY CONSTRAINT');
      expect(augmented).toContain('orthogonally');
    });

    it('should return base prompt if no constraint', () => {
      const basePrompt = 'Generate suggestions.';
      
      const augmented = enforcer._augmentPromptWithConstraint(basePrompt, null);
      
      expect(augmented).toBe(basePrompt);
    });
  });

  describe('_jaccardSimilarity', () => {
    it('should calculate word-level similarity', () => {
      const sim = enforcer._jaccardSimilarity('hello world', 'hello universe');
      
      // One shared word ("hello") out of 3 total unique words
      expect(sim).toBeCloseTo(0.33, 1);
    });

    it('should be case insensitive', () => {
      const sim = enforcer._jaccardSimilarity('HELLO WORLD', 'hello world');
      
      expect(sim).toBe(1.0);
    });

    it('should return 0 for completely different texts', () => {
      const sim = enforcer._jaccardSimilarity('apple', 'orange');
      
      expect(sim).toBe(0);
    });
  });
});

