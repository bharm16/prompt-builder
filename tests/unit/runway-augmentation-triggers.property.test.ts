/**
 * Property-based tests for Runway Augmentation Trigger Injection
 *
 * Tests the following correctness property:
 * - Property 6 (Runway): Augmentation Trigger Injection
 *
 * For any Runway prompt, the augment phase SHALL inject at least one model-specific trigger
 * into the result, and the output SHALL contain all required triggers for Runway
 * (e.g., "single continuous shot", "fluid motion", "consistent geometry").
 *
 * @module runway-augmentation-triggers.property.test
 *
 * **Feature: video-model-optimization, Property 6 (Runway): Augmentation Trigger Injection**
 * **Validates: Requirements 3.5, 3.6, 3.7**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { RunwayStrategy } from '@services/video-prompt-analysis/strategies/RunwayStrategy';

/**
 * Required stability triggers for Runway A2D architecture
 * These MUST be injected by the augment phase
 */
const REQUIRED_STABILITY_TRIGGERS = [
  'single continuous shot',
  'fluid motion',
  'consistent geometry',
] as const;

/**
 * Cinematographic triggers that may be injected based on content
 */
const CINEMATOGRAPHIC_TRIGGERS = [
  'chromatic aberration',
  'anamorphic lens flare',
  'shallow depth of field',
  'film grain',
  'cinematic lighting',
  'volumetric lighting',
  'lens distortion',
  'bokeh',
] as const;

/**
 * Execute the full pipeline for a strategy
 */
async function executePipeline(
  strategy: RunwayStrategy,
  input: string
): Promise<{ prompt: string; metadata: { triggersInjected: string[] } }> {
  await strategy.validate(input);
  const normalized = strategy.normalize(input);
  const transformed = strategy.transform(normalized);
  const augmented = strategy.augment(transformed);

  return {
    prompt: typeof augmented.prompt === 'string' ? augmented.prompt : JSON.stringify(augmented.prompt),
    metadata: augmented.metadata,
  };
}

describe('Runway Augmentation Trigger Injection Property Tests', () => {
  const strategy = new RunwayStrategy();

  /**
   * Property 6 (Runway): Augmentation Trigger Injection
   *
   * For any Runway prompt, the augment phase SHALL inject at least one model-specific trigger
   * into the result, and the output SHALL contain all required triggers for Runway.
   *
   * **Feature: video-model-optimization, Property 6 (Runway): Augmentation Trigger Injection**
   * **Validates: Requirements 3.5, 3.6, 3.7**
   */
  describe('Property 6 (Runway): Augmentation Trigger Injection', () => {
    it('injects "single continuous shot" trigger to prevent hallucinated cuts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Must contain "single continuous shot" trigger
            expect(result.prompt.toLowerCase()).toContain('single continuous shot');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects "fluid motion" trigger for A2D stability', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Must contain "fluid motion" trigger
            expect(result.prompt.toLowerCase()).toContain('fluid motion');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects "consistent geometry" trigger for A2D stability', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Must contain "consistent geometry" trigger
            expect(result.prompt.toLowerCase()).toContain('consistent geometry');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects all three required stability triggers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);
            const lowerPrompt = result.prompt.toLowerCase();

            // All three stability triggers must be present
            for (const trigger of REQUIRED_STABILITY_TRIGGERS) {
              expect(lowerPrompt).toContain(trigger.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('records injected triggers in metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Metadata should contain injected triggers
            expect(result.metadata.triggersInjected.length).toBeGreaterThan(0);

            // At least the stability triggers should be recorded
            const lowerTriggers = result.metadata.triggersInjected.map(t => t.toLowerCase());
            for (const trigger of REQUIRED_STABILITY_TRIGGERS) {
              expect(lowerTriggers).toContain(trigger.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects at least one cinematographic trigger', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);
            const lowerPrompt = result.prompt.toLowerCase();

            // At least one cinematographic trigger should be present
            const hasCinematographicTrigger = CINEMATOGRAPHIC_TRIGGERS.some(
              trigger => lowerPrompt.includes(trigger.toLowerCase())
            );

            expect(hasCinematographicTrigger).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('does not duplicate triggers already present in input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...REQUIRED_STABILITY_TRIGGERS),
          fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (existingTrigger, baseInput) => {
            // Input already contains a trigger
            const input = `${baseInput}, ${existingTrigger}`;

            const result = await executePipeline(strategy, input);
            const lowerPrompt = result.prompt.toLowerCase();

            // Count occurrences of the trigger
            const regex = new RegExp(existingTrigger.toLowerCase(), 'g');
            const matches = lowerPrompt.match(regex);

            // Should only appear once (not duplicated)
            expect(matches?.length ?? 0).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cinematographic Trigger Selection', () => {
    it('injects shallow depth of field for prompts with people', async () => {
      const peopleTerms = ['person', 'man', 'woman', 'character'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...peopleTerms),
          fc.string({ minLength: 0, maxLength: 50 }),
          async (peopleTerm, filler) => {
            const input = `a ${peopleTerm} ${filler}`;

            const result = await executePipeline(strategy, input);

            // Should contain shallow depth of field for subject focus
            expect(result.prompt.toLowerCase()).toContain('shallow depth of field');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects lens flare for outdoor/bright scenes', async () => {
      const outdoorTerms = ['sun', 'outdoor', 'bright', 'daylight'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...outdoorTerms),
          fc.string({ minLength: 0, maxLength: 50 }),
          async (outdoorTerm, filler) => {
            const input = `${filler} ${outdoorTerm} scene`;

            const result = await executePipeline(strategy, input);

            // Should contain anamorphic lens flare
            expect(result.prompt.toLowerCase()).toContain('anamorphic lens flare');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects film grain for cinematic prompts', async () => {
      const cinematicTerms = ['cinematic', 'film', 'movie'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...cinematicTerms),
          fc.string({ minLength: 0, maxLength: 50 }),
          async (cinematicTerm, filler) => {
            const input = `${cinematicTerm} ${filler} shot`;

            const result = await executePipeline(strategy, input);

            // Should contain film grain
            expect(result.prompt.toLowerCase()).toContain('film grain');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects volumetric lighting for atmospheric scenes', async () => {
      const atmosphericTerms = ['fog', 'mist', 'smoke', 'dust'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...atmosphericTerms),
          fc.string({ minLength: 0, maxLength: 50 }),
          async (atmosphericTerm, filler) => {
            const input = `${filler} with ${atmosphericTerm}`;

            const result = await executePipeline(strategy, input);

            // Should contain volumetric lighting
            expect(result.prompt.toLowerCase()).toContain('volumetric lighting');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('injects default cinematic lighting when no specific triggers apply', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate strings that don't contain trigger keywords
          fc.string({ minLength: 5, maxLength: 100 }).filter(s => {
            const lower = s.toLowerCase();
            return s.trim().length > 0 &&
                   !lower.includes('person') &&
                   !lower.includes('man') &&
                   !lower.includes('woman') &&
                   !lower.includes('character') &&
                   !lower.includes('sun') &&
                   !lower.includes('outdoor') &&
                   !lower.includes('bright') &&
                   !lower.includes('day') &&
                   !lower.includes('cinematic') &&
                   !lower.includes('film') &&
                   !lower.includes('movie') &&
                   !lower.includes('fog') &&
                   !lower.includes('mist') &&
                   !lower.includes('smoke') &&
                   !lower.includes('dust');
          }),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Should contain at least cinematic lighting as default
            expect(result.prompt.toLowerCase()).toContain('cinematic lighting');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Trigger Injection Edge Cases', () => {
    it('handles empty-ish input gracefully', async () => {
      // Note: validate() will throw for truly empty input, so we test near-empty
      const result = await executePipeline(strategy, 'a');

      expect(result.prompt).not.toBeNull();
      expect(result.metadata.triggersInjected.length).toBeGreaterThan(0);
    });

    it('handles very long input without breaking', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 100, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Should still inject triggers
            expect(result.metadata.triggersInjected.length).toBeGreaterThan(0);

            // All stability triggers should be present
            const lowerPrompt = result.prompt.toLowerCase();
            for (const trigger of REQUIRED_STABILITY_TRIGGERS) {
              expect(lowerPrompt).toContain(trigger.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles special characters in input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.constantFrom('!@#$%', '<>{}', '"\'`', '\\/', '\n\t'),
          async (baseInput, specialChars) => {
            const input = `${baseInput}${specialChars}`;

            const result = await executePipeline(strategy, input);

            // Should still inject triggers
            expect(result.metadata.triggersInjected.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('limits cinematographic triggers to maximum of 3', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Count cinematographic triggers in output
            const lowerPrompt = result.prompt.toLowerCase();
            let cinematicCount = 0;

            for (const trigger of CINEMATOGRAPHIC_TRIGGERS) {
              if (lowerPrompt.includes(trigger.toLowerCase())) {
                cinematicCount++;
              }
            }

            // Should not exceed 3 cinematographic triggers
            expect(cinematicCount).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
