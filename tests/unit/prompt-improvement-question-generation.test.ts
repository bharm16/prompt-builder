import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { buildEnhancedPrompt, generateFallbackQuestions } from '@/PromptImprovementForm/utils/questionGeneration';

describe('PromptImprovement question generation utils', () => {
  describe('error handling', () => {
    it('returns safe defaults when prompt is empty', () => {
      const result = generateFallbackQuestions('');

      expect(result).toHaveLength(3);
      expect(result[0]?.title).toBe('What specific aspects matter most?');
      expect(result[1]?.field).toBe('backgroundLevel');
      expect(result[2]?.field).toBe('intendedUse');
    });

    it('handles whitespace-only prompts without throwing', () => {
      const result = generateFallbackQuestions('   ');

      expect(result).toHaveLength(3);
      expect(result[0]?.description).toContain('what particular aspects should be emphasized');
    });
  });

  describe('edge cases', () => {
    it('removes polite starters and truncates long topics', () => {
      const longPrompt =
        'Please explain how to migrate a large monolith into microservices with specific steps and trade-offs for a global team';
      const result = generateFallbackQuestions(longPrompt);

      expect(result[0]?.description).toContain('explain how to migrate a large monolith into microservice...');
      expect(result[0]?.description?.toLowerCase()).not.toContain('please');
    });

    it('preserves the initial prompt and only appends provided fields', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              (value) =>
                !value.includes('Specific Focus:') &&
                !value.includes('Audience Level:') &&
                !value.includes('Intended Use:')
            ),
          fc.record({
            specificAspects: fc.string(),
            backgroundLevel: fc.string(),
            intendedUse: fc.string(),
          }),
          (initialPrompt, formData) => {
            const enhanced = buildEnhancedPrompt(initialPrompt, formData);

            expect(enhanced.startsWith(initialPrompt)).toBe(true);
            expect(enhanced.includes(`\n\nSpecific Focus: ${formData.specificAspects}`)).toBe(
              formData.specificAspects.length > 0
            );
            expect(enhanced.includes(`\n\nAudience Level: ${formData.backgroundLevel}`)).toBe(
              formData.backgroundLevel.length > 0
            );
            expect(enhanced.includes(`\n\nIntended Use: ${formData.intendedUse}`)).toBe(
              formData.intendedUse.length > 0
            );
          }
        )
      );
    });
  });

  describe('core behavior', () => {
    it('selects compare prompt messaging when comparison keywords are present', () => {
      const result = generateFallbackQuestions('Compare the costs of AWS and GCP for startups');

      expect(result[0]?.title).toBe('What comparison criteria matter most?');
      expect(result[1]?.title).toBe('How familiar are you with these options?');
      expect(result[2]?.title).toBe('What decision are you making?');
  });
});
});
