/**
 * @test {ContextAwareExamples}
 * @description Unit tests for universal part-of-speech aware example generation
 * 
 * Test Coverage:
 * - Part-of-speech detection (noun, adjective, verb, adverb)
 * - Word count awareness
 * - Grammatical context analysis
 * - Generic examples that teach grammar, not semantics
 */

import { describe, it, expect } from 'vitest';
import { ContextAwareExamples } from '../ContextAwareExamples.js';

describe('ContextAwareExamples - Universal Part-of-Speech', () => {
  // ============================================
  // Part-of-Speech Detection
  // ============================================

  describe('Noun Detection', () => {
    it('should detect standalone noun after possessive', () => {
      const examples = ContextAwareExamples.generateExamples('hands', null, null, "painter's ", ' gripping');
      
      expect(examples).toHaveLength(3);
      expect(examples[0].category).toBe('Noun Alternatives');
      expect(examples[0].text).toBe('element');
    });

    it('should detect noun with verb after', () => {
      const examples = ContextAwareExamples.generateExamples('hands', null, null, '', ' gripping');
      
      expect(examples[0].category).toBe('Noun Alternatives');
    });

    it('should detect noun after "the"', () => {
      const examples = ContextAwareExamples.generateExamples('canvas', null, null, 'the ', '');
      
      expect(examples[0].category).toBe('Noun Alternatives');
    });

    it('should detect noun after "their"', () => {
      const examples = ContextAwareExamples.generateExamples('work', null, null, 'their ', '');
      
      expect(examples[0].category).toBe('Noun Alternatives');
    });

    it('should default single words to nouns', () => {
      const examples = ContextAwareExamples.generateExamples('something', null, null, '', '');
      
      expect(examples[0].category).toBe('Noun Alternatives');
    });
  });

  describe('Adjective Detection', () => {
    it('should detect adjective after article "a"', () => {
      const examples = ContextAwareExamples.generateExamples('beautiful', null, null, 'a ', ' painting');
      
      expect(examples).toHaveLength(3);
      expect(examples[0].category).toBe('Single Adjectives');
      expect(examples[0].text).toBe('distinctive');
    });

    it('should detect adjective after "the"', () => {
      const examples = ContextAwareExamples.generateExamples('old', null, null, 'the ', ' painter');
      
      expect(examples[0].category).toBe('Single Adjectives');
    });

    it('should detect adjective before common noun', () => {
      const examples = ContextAwareExamples.generateExamples('skilled', null, null, '', ' artist');
      
      expect(examples[0].category).toBe('Single Adjectives');
    });

    it('should detect adjective before "hands"', () => {
      const examples = ContextAwareExamples.generateExamples('weathered', null, null, '', ' hands');
      
      expect(examples[0].category).toBe('Single Adjectives');
    });

    it('should detect adjective after "some"', () => {
      const examples = ContextAwareExamples.generateExamples('interesting', null, null, 'some ', ' paintings');
      
      expect(examples[0].category).toBe('Single Adjectives');
    });
  });

  describe('Verb Detection', () => {
    it('should detect gerund verb with article after', () => {
      const examples = ContextAwareExamples.generateExamples('gripping', null, null, 'hands ', ' a paintbrush');
      
      expect(examples).toHaveLength(3);
      expect(examples[0].category).toBe('Single Verbs');
      expect(examples[0].text).toBe('engaging');
    });

    it('should detect gerund with "the" after', () => {
      const examples = ContextAwareExamples.generateExamples('holding', null, null, '', ' the brush');
      
      expect(examples[0].category).toBe('Single Verbs');
    });

    it('should detect gerund with "an" after', () => {
      const examples = ContextAwareExamples.generateExamples('wielding', null, null, '', ' an instrument');
      
      expect(examples[0].category).toBe('Single Verbs');
    });
  });

  describe('Adverb Detection', () => {
    it('should detect adverb after "was"', () => {
      const examples = ContextAwareExamples.generateExamples('carefully', null, null, 'was ', ' working');
      
      expect(examples).toHaveLength(3);
      expect(examples[0].category).toBe('Manner Adverbs');
      expect(examples[0].text).toBe('deliberately');
    });

    it('should detect adverb after "is"', () => {
      const examples = ContextAwareExamples.generateExamples('slowly', null, null, 'is ', ' working');
      
      expect(examples[0].category).toBe('Manner Adverbs');
    });

    it('should detect adverb after "very"', () => {
      const examples = ContextAwareExamples.generateExamples('quickly', null, null, 'very ', '');
      
      expect(examples[0].category).toBe('Manner Adverbs');
    });
  });

  // ============================================
  // Word Count Awareness
  // ============================================

  describe('Word Count Matching', () => {
    it('should generate single-word examples for single-word input', () => {
      const examples = ContextAwareExamples.generateExamples('hands', null, null, '', '');
      
      examples.forEach(ex => {
        expect(ex.text.split(/\s+/).length).toBe(1);
      });
    });

    it('should generate multi-word examples for multi-word input', () => {
      const examples = ContextAwareExamples.generateExamples('weathered hands', null, null, '', '');
      
      examples.forEach(ex => {
        expect(ex.text.split(/\s+/).length).toBeGreaterThan(1);
      });
    });

    it('should respect videoConstraints for single word', () => {
      const constraints = { minWords: 1, maxWords: 1 };
      const examples = ContextAwareExamples.generateExamples('test', null, null, '', '', constraints);
      
      examples.forEach(ex => {
        expect(ex.text.split(/\s+/).length).toBe(1);
      });
    });

    it('should respect videoConstraints for multi-word', () => {
      const constraints = { minWords: 3, maxWords: 3 };
      const examples = ContextAwareExamples.generateExamples('test', null, null, '', '', constraints);
      
      examples.forEach(ex => {
        const wordCount = ex.text.split(/\s+/).length;
        expect(wordCount).toBeGreaterThanOrEqual(2);
      });
    });

    it('should handle article+noun pattern for single-word slots', () => {
      const examples = ContextAwareExamples.generateExamples('gripping', null, null, '', ' a paintbrush');
      
      examples.forEach(ex => {
        expect(ex.text.split(/\s+/).length).toBe(1);
      });
    });
  });

  // ============================================
  // Universal Applicability
  // ============================================

  describe('Works for Any Word', () => {
    it('should work for unknown nouns', () => {
      const examples = ContextAwareExamples.generateExamples('xylophone', null, null, "painter's ", '');
      
      expect(examples[0].category).toBe('Noun Alternatives');
    });

    it('should work for unknown adjectives', () => {
      const examples = ContextAwareExamples.generateExamples('zephyr-like', null, null, 'a ', ' breeze');
      
      expect(examples[0].category).toBe('Single Adjectives');
    });

    it('should work for unknown verbs', () => {
      const examples = ContextAwareExamples.generateExamples('oscillating', null, null, '', ' a device');
      
      expect(examples[0].category).toBe('Single Verbs');
    });

    it('should not require semantic category knowledge', () => {
      // Works without knowing if it's a "body part" or "material"
      const examples = ContextAwareExamples.generateExamples('widget', null, null, '', '');
      
      expect(examples).toHaveLength(3);
      expect(examples[0]).toHaveProperty('text');
      expect(examples[0]).toHaveProperty('category');
      expect(examples[0]).toHaveProperty('explanation');
    });
  });

  // ============================================
  // Real-World Scenarios
  // ============================================

  describe('Real-World Use Cases', () => {
    it('CRITICAL BUG FIX: "hands" (noun) should get noun examples', () => {
      const examples = ContextAwareExamples.generateExamples('hands', null, null, "painter's ", ' gripping');
      
      // Should be noun alternatives, not adjectives
      expect(examples[0].category).toBe('Noun Alternatives');
      expect(examples[0].text).not.toMatch(/weathered|stained|aged/); // Not adjectives
    });

    it('should give adjective examples for descriptor slot', () => {
      const examples = ContextAwareExamples.generateExamples('skilled', null, null, 'a ', ' painter');
      
      // Should be adjectives
      expect(examples[0].category).toBe('Single Adjectives');
    });

    it('should give verb examples for action slot', () => {
      const examples = ContextAwareExamples.generateExamples('gripping', null, null, 'hands ', ' a brush');
      
      // Should be verbs
      expect(examples[0].category).toBe('Single Verbs');
    });

    it('painter scenario: "painter\'s hands gripping a paintbrush"', () => {
      // Click "hands" (noun after possessive)
      const handsExamples = ContextAwareExamples.generateExamples('hands', null, null, "painter's ", ' gripping');
      expect(handsExamples[0].category).toBe('Noun Alternatives');
      
      // Click "gripping" (verb with article after)
      const grippingExamples = ContextAwareExamples.generateExamples('gripping', null, null, 'hands ', ' a paintbrush');
      expect(grippingExamples[0].category).toBe('Single Verbs');
      
      // Click "paintbrush" (noun after article)
      const brushExamples = ContextAwareExamples.generateExamples('paintbrush', null, null, 'a ', '');
      expect(brushExamples[0].category).toBe('Noun Alternatives');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle null contextBefore', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null, null, '');
      
      expect(examples).toHaveLength(3);
    });

    it('should handle null contextAfter', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null, '', null);
      
      expect(examples).toHaveLength(3);
    });

    it('should handle empty strings', () => {
      const examples = ContextAwareExamples.generateExamples('', null, null, '', '');
      
      expect(examples).toHaveLength(3);
    });

    it('should handle whitespace', () => {
      const examples = ContextAwareExamples.generateExamples('  test  ', null, null, '  ', '  ');
      
      expect(examples).toHaveLength(3);
    });

    it('should always return 3 examples', () => {
      const testCases = [
        ['hands', '', ''],
        ['beautiful', 'a ', ' painting'],
        ['gripping', '', ' a brush'],
        ['carefully', 'was ', ' working']
      ];

      testCases.forEach(([text, before, after]) => {
        const examples = ContextAwareExamples.generateExamples(text, null, null, before, after);
        expect(examples).toHaveLength(3);
      });
    });

    it('should always return valid structure', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null, '', '');
      
      examples.forEach(ex => {
        expect(ex).toHaveProperty('text');
        expect(ex).toHaveProperty('category');
        expect(ex).toHaveProperty('explanation');
        expect(typeof ex.text).toBe('string');
        expect(typeof ex.category).toBe('string');
        expect(typeof ex.explanation).toBe('string');
        expect(ex.text.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // Backward Compatibility
  // ============================================

  describe('Backward Compatibility', () => {
    it('should accept old signature (3 params)', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null);
      
      expect(examples).toHaveLength(3);
    });

    it('should accept old signature (4 params)', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null, '');
      
      expect(examples).toHaveLength(3);
    });

    it('should accept old signature (5 params)', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null, '', '');
      
      expect(examples).toHaveLength(3);
    });

    it('should accept full signature (6 params)', () => {
      const examples = ContextAwareExamples.generateExamples('test', null, null, '', '', null);
      
      expect(examples).toHaveLength(3);
    });

    it('should ignore category and type parameters (kept for compatibility)', () => {
      // Old code might pass semantic categories, but they're ignored now
      const examples = ContextAwareExamples.generateExamples('hands', 'body_part', 'noun', '', '');
      
      // Should work fine, category/type ignored
      expect(examples).toHaveLength(3);
    });
  });
});
