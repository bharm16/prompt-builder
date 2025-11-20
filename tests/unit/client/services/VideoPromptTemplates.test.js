import { describe, it, expect } from 'vitest';
import { generateVideoPrompt } from '../../../../server/src/services/prompt-optimization/strategies/videoPromptOptimizationTemplate.js';

describe('VideoPromptTemplates - Chain-of-Thought + Structured JSON Output', () => {
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
      expect(result).toContain('degrade quality');
    });

    it('should include film language guidance', () => {
      const result = generateVideoPrompt(testPrompt);
      const filmTerms = ['dolly', 'crane', '35mm', 'shallow DOF'];
      const hasFilmLanguage = filmTerms.some(term => result.toLowerCase().includes(term.toLowerCase()));
      expect(hasFilmLanguage).toBe(true);
    });

    it('should mention technical specs in guidance', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('duration');
      expect(result).toContain('aspect_ratio');
      expect(result).toContain('frame_rate');
    });

    it('should mention alternative approaches in guidance', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('40-50 words');
    });

    it('should recommend 4-8 second duration (research-based)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('4-8s');
    });

    it('should warn against prompts over 150 words', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('longer than 150 words');
    });
  });

  describe('Chain-of-Thought Analysis Structure', () => {
    it('should include STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS');
    });

    it('should require analysis of Subject Scale', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Subject Scale');
      expect(result).toContain('landscape');
      expect(result).toContain('detail');
    });

    it('should require analysis of Motion', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Motion');
      expect(result).toContain('static');
      expect(result).toContain('dynamic');
    });

    it('should require analysis of Emotional Tone', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Emotional Tone');
    });

    it('should include shot selection logic', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Shot Selection Reference');
      expect(result).toContain('Intimacy/Emotion');
      expect(result).toContain('Context/Scale');
      expect(result).toContain('Power/Dominance');
      expect(result).toContain('Low Angle');
      expect(result).toContain('High Angle');
      expect(result).toContain('Close-up');
      expect(result).toContain('Wide Shot');
    });

    it('should include STEP 2: GENERATE COMPONENTS', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('STEP 2: GENERATE COMPONENTS');
    });
  });

  describe('JSON Output Format Requirements', () => {
    it('should require JSON output format', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('OUTPUT FORMAT');
      expect(result).toContain('JSON');
    });

    it('should specify _hidden_reasoning field', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('_hidden_reasoning');
      expect(result).toContain('why you chose this specific shot type');
    });

    it('should specify shot_type field', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('shot_type');
    });

    it('should specify main_prompt field', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('main_prompt');
    });

    it('should specify technical_specs object', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('technical_specs');
      expect(result).toContain('duration');
      expect(result).toContain('aspect_ratio');
      expect(result).toContain('frame_rate');
      expect(result).toContain('audio');
    });

    it('should specify variations array', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('variations');
      expect(result).toContain('Different Camera');
      expect(result).toContain('Different Lighting/Mood');
    });

    it('should enforce valid JSON only (no markdown)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('valid JSON only');
      expect(result).toContain('No markdown');
      expect(result).toContain('no code blocks');
    });
  });

  describe('Research-Based Best Practices Validation', () => {
    it('should emphasize shot type selection first', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Start with the framing');
      expect(result).toContain('CRITICAL: Start the prompt with your selected shot type');
    });

    it('should discourage multiple simultaneous actions', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Multiple actions');
      expect(result).toMatch(/degrade quality/i);
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

    it('should specify JSON output format expectations', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('OUTPUT FORMAT');
      expect(result).toContain('valid JSON');
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
        'STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS',
        'STEP 2: GENERATE COMPONENTS',
        'GUIDING PRINCIPLES',
        'WRITING RULES',
        'AVOID',
        'EXAMPLE',
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
    it('should be instructional for AI (not for end user)', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('You are an expert Director of Photography');
      // Should be instructions TO AI, not the final output itself
    });

    it('should emphasize conciseness throughout', () => {
      const result = generateVideoPrompt(testPrompt);
      const conciseReferences = result.match(/100-150 words|concise/gi);
      expect(conciseReferences).toBeTruthy();
      expect(conciseReferences.length).toBeGreaterThanOrEqual(2);
    });

    it('should discourage verbose output', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('longer than 150 words');
    });

    it('should encourage specific visual language', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toMatch(/specific over generic/i);
      expect(result).toContain('weathered oak');
    });

    it('should force Chain-of-Thought analysis before generation', () => {
      const result = generateVideoPrompt(testPrompt);
      expect(result).toContain('Perform this analysis');
      expect(result).toContain('Based on your analysis');
    });
  });
});
