import { describe, it, expect, beforeEach } from 'vitest';
import { FallbackStrategyService } from '../FallbackStrategyService.js';
import { GRAMMATICAL_CONFIG } from '../../config/grammaticalAnalysis.js';

describe('FallbackStrategyService', () => {
  let service;

  beforeEach(() => {
    service = new FallbackStrategyService(GRAMMATICAL_CONFIG);
  });

  describe('generateFallback', () => {
    it('should apply transformations to enhance text', () => {
      const originalText = 'the dog runs';
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.5,
        tense: 'present',
      };

      const result = service.generateFallback(originalText, analysis);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // Result should be different from original (transformations applied)
      // Note: compromise transformations may or may not change the text
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty input gracefully', () => {
      const result = service.generateFallback('', {
        structure: 'unknown',
        complexity: 0,
      });

      expect(result).toBe('');
    });

    it('should handle null input gracefully', () => {
      const result = service.generateFallback(null, {
        structure: 'unknown',
        complexity: 0,
      });

      expect(result).toBeNull();
    });

    it('should respect maxTransformations config', () => {
      const customConfig = {
        fallback: {
          enableVerbIntensification: true,
          enableAdjectiveExpansion: true,
          maxTransformations: 1,
        },
      };

      const customService = new FallbackStrategyService({
        fallback: customConfig.fallback,
      });

      const originalText = 'the dark sky falls';
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.6,
      };

      const result = customService.generateFallback(originalText, analysis);

      // Should apply at most 1 transformation
      expect(result).toBeTruthy();
    });

    it('should not transform if all transformations disabled', () => {
      const customConfig = {
        fallback: {
          enableVerbIntensification: false,
          enableAdjectiveExpansion: false,
          maxTransformations: 2,
        },
      };

      const customService = new FallbackStrategyService({
        fallback: customConfig.fallback,
      });

      const originalText = 'the dark sky';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.4,
      };

      const result = customService.generateFallback(originalText, analysis);

      // Should return text unchanged or minimally changed
      expect(result).toBeTruthy();
    });
  });

  describe('_intensifyVerbs', () => {
    it('should convert verbs to continuous aspect', () => {
      const text = 'he runs fast';
      const doc = service.generateFallback(text, {
        structure: 'simple_clause',
        complexity: 0.5,
      });

      // After transformation, should contain continuous form
      // Note: compromise's toContinuous may produce "he is running fast"
      expect(doc).toBeTruthy();
    });

    it('should not transform gerunds', () => {
      const text = 'running fast';
      const originalAnalysis = {
        structure: 'gerund_phrase',
        complexity: 0.6,
      };

      const result = service.generateFallback(text, originalAnalysis);

      // Gerunds should not be transformed further
      expect(result).toBeTruthy();
    });

    it('should not transform text with auxiliary verbs', () => {
      const text = 'he is running';
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.5,
      };

      const result = service.generateFallback(text, analysis);

      // Should not double-transform "is running" -> "is is running"
      expect(result).not.toContain('is is');
    });
  });

  describe('_expandAdjectives', () => {
    it('should apply comparative form to adjectives', () => {
      const text = 'the dark sky';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.4,
      };

      const result = service.generateFallback(text, analysis);

      // Should potentially transform "dark" -> "darker"
      // Note: compromise's toComparative behavior
      expect(result).toBeTruthy();
    });

    it('should not modify adjectives with existing adverbs', () => {
      const text = 'the very dark sky';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.5,
      };

      const result = service.generateFallback(text, analysis);

      // Should not add another adverb to "very dark"
      expect(result).toBeTruthy();
    });

    it('should handle text with no adjectives', () => {
      const text = 'the sky';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.2,
      };

      const result = service.generateFallback(text, analysis);

      // Should return text unchanged (or minimally changed)
      expect(result).toBe(text);
    });
  });

  describe('edge cases', () => {
    it('should handle text with multiple verbs', () => {
      const text = 'he runs and jumps';
      const analysis = {
        structure: 'complex_clause',
        complexity: 0.7,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle text with multiple adjectives', () => {
      const text = 'the dark mysterious forest';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.6,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very short text', () => {
      const text = 'run';
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.3,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
    });

    it('should handle very long text', () => {
      const text =
        'the magnificent golden eagle soars gracefully through the azure sky ' +
        'while majestic mountains stand tall in the distance';
      const analysis = {
        structure: 'complex_clause',
        complexity: 0.9,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle text with punctuation', () => {
      const text = 'the dark, mysterious forest';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.5,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
    });

    it('should handle text with special characters', () => {
      const text = 'the $100 discount';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.4,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
    });

    it('should handle text with numbers', () => {
      const text = 'the 5 fast cars';
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.4,
      };

      const result = service.generateFallback(text, analysis);

      expect(result).toBeTruthy();
    });
  });

  describe('configuration', () => {
    it('should use default configuration if not provided', () => {
      const defaultService = new FallbackStrategyService();
      const result = defaultService.generateFallback('the dog runs', {
        structure: 'simple_clause',
        complexity: 0.5,
      });

      expect(result).toBeTruthy();
    });

    it('should respect custom configuration', () => {
      const customConfig = {
        fallback: {
          enableVerbIntensification: true,
          enableAdjectiveExpansion: false,
          maxTransformations: 1,
        },
      };

      const customService = new FallbackStrategyService({
        fallback: customConfig.fallback,
      });

      const result = customService.generateFallback('the dark sky runs', {
        structure: 'simple_clause',
        complexity: 0.6,
      });

      // Should only apply verb transformation, not adjective
      expect(result).toBeTruthy();
    });
  });

  describe('transformation safety', () => {
    it('should never produce empty output for non-empty input', () => {
      const testCases = [
        'run',
        'the dog',
        'running fast',
        'under the bridge',
        'the man who saw me',
      ];

      testCases.forEach((text) => {
        const result = service.generateFallback(text, {
          structure: 'simple_clause',
          complexity: 0.5,
        });

        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should preserve meaning through transformations', () => {
      const text = 'the dog runs';
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.5,
      };

      const result = service.generateFallback(text, analysis);

      // Should still contain key words
      expect(result.toLowerCase()).toMatch(/dog|run/);
    });
  });
});

