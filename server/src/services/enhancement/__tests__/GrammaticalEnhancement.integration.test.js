import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrammaticalAnalysisService } from '../services/GrammaticalAnalysisService.js';
import { FallbackStrategyService } from '../services/FallbackStrategyService.js';
import { GRAMMATICAL_CONFIG } from '../config/grammaticalAnalysis.js';

/**
 * Integration tests for the grammatical enhancement system
 * Tests the complete flow from analysis to fallback transformation
 */
describe('Grammatical Enhancement Integration', () => {
  let analyzer;
  let fallbackService;

  beforeEach(() => {
    analyzer = new GrammaticalAnalysisService(GRAMMATICAL_CONFIG);
    fallbackService = new FallbackStrategyService(GRAMMATICAL_CONFIG);
  });

  describe('End-to-end flow', () => {
    it('should analyze and classify simple spans correctly', () => {
      const text = 'bright colors';
      const analysis = analyzer.analyzeSpan(text, {
        contextBefore: 'The painting has ',
        contextAfter: ' throughout',
      });

      expect(analysis.structure).toBe('noun_phrase');
      expect(analysis.complexity).toBeLessThan(GRAMMATICAL_CONFIG.complexityThreshold);
      expect(analysis.tense).toBe('neutral');
    });

    it('should analyze and classify complex spans correctly', () => {
      const text = 'running swiftly through the ancient forest';
      const analysis = analyzer.analyzeSpan(text, {
        contextBefore: 'The deer was ',
        contextAfter: ' at dawn',
      });

      expect(analysis.complexity).toBeGreaterThan(GRAMMATICAL_CONFIG.complexityThreshold);
      // Should be classified as a complex structure
      expect(analysis.doc).toBeTruthy();
    });

    it('should route simple spans to standard path (complexity < threshold)', () => {
      const testCases = [
        'red car',
        'bright light',
        'the house',
        'small dog',
      ];

      testCases.forEach((text) => {
        const analysis = analyzer.analyzeSpan(text, {});
        expect(analysis.complexity).toBeLessThan(GRAMMATICAL_CONFIG.complexityThreshold);
      });
    });

    it('should route complex spans to complex handling (complexity > threshold)', () => {
      const testCases = [
        'running swiftly down the cobblestone street',
        'glowing embers crackling in the fireplace',
        'cascading waterfalls tumbling over ancient rocks',
      ];

      testCases.forEach((text) => {
        const analysis = analyzer.analyzeSpan(text, {});
        // These should have complexity above threshold OR be complex structures
        const requiresComplexHandling =
          analysis.complexity > GRAMMATICAL_CONFIG.complexityThreshold ||
          GRAMMATICAL_CONFIG.complexStructures.includes(analysis.structure);
        
        expect(requiresComplexHandling).toBe(true);
      });
    });

    it('should apply fallback transformations when needed', () => {
      const text = 'the dark sky falls';
      const analysis = analyzer.analyzeSpan(text, {});
      
      const fallbackResult = fallbackService.generateFallback(text, analysis);

      expect(fallbackResult).toBeTruthy();
      expect(typeof fallbackResult).toBe('string');
      expect(fallbackResult.length).toBeGreaterThan(0);
    });

    it('should preserve key information through fallback transformation', () => {
      const text = 'the dog runs';
      const analysis = analyzer.analyzeSpan(text, {});
      
      const fallbackResult = fallbackService.generateFallback(text, analysis);

      // Should still contain key words
      expect(fallbackResult.toLowerCase()).toMatch(/dog/);
    });
  });

  describe('Configuration-based routing', () => {
    it('should identify gerund phrases as complex structures', () => {
      const text = 'running quickly';
      const analysis = analyzer.analyzeSpan(text, {});

      // Gerund phrases should be in complex structures list
      const isComplexStructure = GRAMMATICAL_CONFIG.complexStructures.includes('gerund_phrase');
      expect(isComplexStructure).toBe(true);

      // If detected as gerund, should route to complex handling
      if (analysis.structure === 'gerund_phrase') {
        expect(GRAMMATICAL_CONFIG.complexStructures).toContain(analysis.structure);
      }
    });

    it('should use complexity threshold for routing decisions', () => {
      expect(GRAMMATICAL_CONFIG.complexityThreshold).toBe(0.6);
      expect(GRAMMATICAL_CONFIG.complexityThreshold).toBeGreaterThan(0);
      expect(GRAMMATICAL_CONFIG.complexityThreshold).toBeLessThan(1);
    });

    it('should have proper retry configuration', () => {
      expect(GRAMMATICAL_CONFIG.retry.maxAttempts).toBe(3);
      expect(GRAMMATICAL_CONFIG.retry.initialTemperature).toBeCloseTo(0.9);
      expect(GRAMMATICAL_CONFIG.retry.initialStrictness).toBeCloseTo(0.5);
    });
  });

  describe('Complexity scoring', () => {
    it('should produce consistent complexity scores', () => {
      const text = 'the dog runs fast';
      
      // Run analysis multiple times
      const scores = Array(5)
        .fill(null)
        .map(() => analyzer.analyzeSpan(text, {}).complexity);

      // All scores should be identical (deterministic)
      const firstScore = scores[0];
      scores.forEach((score) => {
        expect(score).toBe(firstScore);
      });
    });

    it('should rank complexity correctly', () => {
      const samples = [
        { text: 'car', expectedRange: 'low' },
        { text: 'the red car', expectedRange: 'low' },
        { text: 'the car drives', expectedRange: 'medium' },
        { text: 'running swiftly through forests', expectedRange: 'high' },
      ];

      const results = samples.map((sample) => ({
        ...sample,
        complexity: analyzer.analyzeSpan(sample.text, {}).complexity,
      }));

      // Verify increasing complexity
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i + 1].complexity).toBeGreaterThanOrEqual(results[i].complexity);
      }
    });

    it('should apply sigmoid normalization (0-1 range)', () => {
      const testTexts = [
        'a',
        'bright red',
        'the magnificent golden eagle soars',
        'running swiftly through the ancient mysterious forest under moonlight',
      ];

      testTexts.forEach((text) => {
        const analysis = analyzer.analyzeSpan(text, {});
        expect(analysis.complexity).toBeGreaterThanOrEqual(0);
        expect(analysis.complexity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Structure detection accuracy', () => {
    it('should detect tense correctly across different structures', () => {
      const testCases = [
        { text: 'he ran fast', expectedTense: 'past' },
        { text: 'he runs fast', expectedTense: 'present' },
        { text: 'running fast', expectedTense: 'neutral' },
        { text: 'bright colors', expectedTense: 'neutral' },
      ];

      testCases.forEach(({ text, expectedTense }) => {
        const analysis = analyzer.analyzeSpan(text, {});
        expect(analysis.tense).toBe(expectedTense);
      });
    });

    it('should detect plurality correctly', () => {
      const testCases = [
        { text: 'the dogs', expectedPlural: true },
        { text: 'the dog', expectedPlural: false },
        { text: 'bright colors', expectedPlural: true },
        { text: 'bright color', expectedPlural: false },
      ];

      testCases.forEach(({ text, expectedPlural }) => {
        const analysis = analyzer.analyzeSpan(text, {});
        expect(analysis.isPlural).toBe(expectedPlural);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty strings gracefully', () => {
      const analysis = analyzer.analyzeSpan('', {});
      
      expect(analysis.structure).toBe('unknown');
      expect(analysis.complexity).toBe(0);
      
      const fallback = fallbackService.generateFallback('', analysis);
      expect(fallback).toBe('');
    });

    it('should handle null inputs gracefully', () => {
      const analysis = analyzer.analyzeSpan(null, {});
      
      expect(analysis.structure).toBe('unknown');
      expect(analysis.complexity).toBe(0);
    });

    it('should handle very long text without errors', () => {
      const longText = Array(100).fill('word').join(' ');
      
      expect(() => {
        analyzer.analyzeSpan(longText, {});
      }).not.toThrow();
    });

    it('should handle special characters and numbers', () => {
      const testCases = [
        'the $100 discount',
        '5 fast cars',
        'email@example.com',
        'test-case-123',
      ];

      testCases.forEach((text) => {
        expect(() => {
          analyzer.analyzeSpan(text, {});
        }).not.toThrow();
      });
    });
  });
});

