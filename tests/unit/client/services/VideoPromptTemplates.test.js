import { describe, it, expect } from 'vitest';
import { generateVideoPrompt } from '../../../../server/src/services/prompt-optimization/strategies/videoPromptOptimizationTemplate.js';

describe('VideoPromptTemplates - Research-Based Single Template', () => {
  const testPrompt = 'A cat jumping over a fence';

  describe('generateVideoPrompt', () => {
    it('should generate a valid prompt template', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100);
    });

    it('should include the user prompt in the output', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain(testPrompt);
    });

    it('should reference 100-150 word target (OpenAI research)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('100-150 words');
    });

    it('should target optimal word count', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('100-150 words');
    });

    it('should include research-based structure guidance', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Shot Type:');
      expect(result).toContain('Subject:');
      expect(result).toContain('Action:');
      expect(result).toContain('Camera:');
      expect(result).toContain('Lighting:');
    });

    it('should emphasize single action per clip', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('ONE clear, specific');
      expect(result).toContain('severely degrade quality');
    });

    it('should include film language guidance', () => {
      const result = generateVideoPrompt(testPrompt);
      const filmTerms = ['dolly', 'crane', '35mm', 'shallow DOF'];
      const hasFilmLanguage = filmTerms.some(term => result.toLowerCase().includes(term.toLowerCase()));
      expect(hasFilmLanguage).toBe(true);
    });

    it('should include technical specs section', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('**TECHNICAL SPECS**');
      expect(result).toContain('Duration');
      expect(result).toContain('Aspect Ratio');
      expect(result).toContain('Frame Rate');
    });

    it('should include alternative approaches section', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('ALTERNATIVE APPROACHES');
      expect(result).toContain('40-50 words');
    });

    it('should recommend 4-8 second duration (research-based)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('4-8s');
      expect(result).toContain('Optimal');
    });

    it('should warn against prompts over 150 words', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('longer than 150 words');
    });
  });

  describe('Research-Based Best Practices Validation', () => {
    it('should emphasize priority ordering (first element = most important)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('order of importance');
      expect(result).toContain('FIRST');
    });

    it('should discourage multiple simultaneous actions', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('multiple simultaneous actions');
      expect(result).toMatch(/multiple.*actions.*degrade/i);
    });

    it('should include example showing proper structure', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('EXAMPLE');
      // Check for a concrete example sentence
      const hasExampleSentence = result.includes('Close-up') || result.includes('Wide shot') || result.includes('Medium shot');
      expect(hasExampleSentence).toBe(true);
    });

    it('should provide writing rules section', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('WRITING RULES');
      expect(result).toContain('✓'); // Check marks for do's
      expect(result).toContain('✗'); // X marks for don'ts
    });

    it('should specify output format expectations', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('OUTPUT FORMAT');
      expect(result).toContain('Begin directly');
      expect(result).toContain('Do not include any preamble');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompt gracefully', () => {
      const result = generateVideoPrompt('');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle very long prompts', () => {
      const longPrompt = 'a '.repeat(500) + 'complex scene';
      const result = generateVideoPrompt(longPrompt);
      expect(result).toBeTruthy();
      expect(result).toContain(longPrompt);
    });

    it('should handle prompts with special characters', () => {
      const specialPrompt = 'A scene with "quotes" and \'apostrophes\' and [brackets]';
      const result = generateVideoPrompt(specialPrompt);
      expect(result).toBeTruthy();
      expect(result).toContain(specialPrompt);
    });

    it('should handle prompts with line breaks', () => {
      const multilinePrompt = 'First line\nSecond line\nThird line';
      const result = generateVideoPrompt(multilinePrompt);
      expect(result).toBeTruthy();
    });
  });

  describe('Platform Support', () => {
    it('should support major AI video platforms', () => {
      const result = generateVideoPrompt(testPrompt);
      // Template should work with these platforms
      // No need to explicitly mention all of them in output
      expect(result).toBeTruthy();
    });
  });

  describe('Template Completeness', () => {
    it('should include all required structural elements', () => {
      const result = generateVideoPrompt(testPrompt);
      const requiredElements = [
        'GUIDING PRINCIPLES',
        'WRITING RULES',
        'AVOID',
        'EXAMPLE',
        'TECHNICAL SPECS',
        'ALTERNATIVE APPROACHES',
        'OUTPUT FORMAT'
      ];

      requiredElements.forEach(element => {
        expect(result).toContain(element);
      });
    });

    it('should provide 7 required elements in priority order', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('1.  **Shot Type:**');
      expect(result).toContain('2.  **Subject:**');
      expect(result).toContain('3.  **Action:**');
      expect(result).toContain('4.  **Setting:**');
      expect(result).toContain('5.  **Camera:**');
      expect(result).toContain('6.  **Lighting:**');
      expect(result).toContain('7.  **Style:**');
    });

    it('should provide at least 5 writing rules', () => {
      const result = generateVideoPrompt(testPrompt);
      const checkMarks = result.match(/✓/g);
      expect(checkMarks).toBeTruthy();
      expect(checkMarks.length).toBeGreaterThanOrEqual(5);
    });

    it('should provide at least 4 avoid patterns', () => {
      const result = generateVideoPrompt(testPrompt);
      const xMarks = result.match(/✗/g);
      expect(xMarks).toBeTruthy();
      expect(xMarks.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Quality Assurance', () => {
    it('should be instructional for Claude (not for end user)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Transform the following');
      // Should be instructions TO Claude, not the final output itself
    });

    it('should emphasize conciseness throughout', () => {
      const result = generateVideoPrompt(testPrompt);
      const conciseReferences = result.match(/100-150 words|concise|brief|short/gi);
      expect(conciseReferences).toBeTruthy();
      expect(conciseReferences.length).toBeGreaterThanOrEqual(3);
    });

    it('should discourage verbose output', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('longer than 150 words');
      expect(result).toContain('sequence of events');
      expect(result).toContain('Use multiple clips');
    });

    it('should encourage specific visual language', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toMatch(/specific.*generic|specific over generic/i);
      expect(result).toContain('weathered oak');
    });
  });
});
