/**
 * Property-based tests for TechStripper Model-Aware Behavior
 *
 * Tests the following correctness property:
 * - Property 7: TechStripper Model-Aware Behavior
 *
 * For any input containing placebo tokens ("4k", "8k", "trending on artstation",
 * "award winning") and any model identifier, TechStripper SHALL remove tokens
 * for Runway/Luma models and preserve tokens for Kling/Veo models.
 *
 * @module tech-stripper.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { TechStripper } from '@services/video-prompt-analysis/utils/TechStripper';

describe('TechStripper Property Tests', () => {
  const stripper = new TechStripper();

  // Models where tokens should be STRIPPED
  const stripModels = ['runway-gen45', 'luma-ray3'];

  // Models where tokens should be KEPT
  const keepModels = ['kling-26', 'veo-4', 'sora-2'];

  // Core placebo tokens from requirements
  const corePlaceboTokens = ['4k', '8k', 'trending on artstation', 'award winning'];

  /**
   * Property 7: TechStripper Model-Aware Behavior
   *
   * For any input containing placebo tokens and any model identifier,
   * TechStripper SHALL remove tokens for Runway/Luma models and
   * preserve tokens for Kling/Veo models.
   *
   * **Feature: video-model-optimization, Property 7: TechStripper Model-Aware Behavior**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
   */
  describe('Property 7: TechStripper Model-Aware Behavior', () => {
    it('removes placebo tokens for Runway/Luma models', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...stripModels),
          fc.constantFrom(...corePlaceboTokens),
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (modelId, placeboToken, prefix, suffix) => {
            const input = `${prefix} ${placeboToken} ${suffix}`.trim();
            const result = stripper.strip(input, modelId);

            // Token should be removed from output
            const tokenRegex = new RegExp(`\\b${placeboToken}\\b`, 'i');
            expect(result.text).not.toMatch(tokenRegex);

            // Should report that tokens were stripped
            expect(result.tokensWereStripped).toBe(true);

            // Stripped tokens should include the placebo token
            expect(
              result.strippedTokens.some(
                (t) => t.toLowerCase() === placeboToken.toLowerCase()
              )
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves placebo tokens for Kling/Veo/Sora models', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...keepModels),
          fc.constantFrom(...corePlaceboTokens),
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (modelId, placeboToken, prefix, suffix) => {
            const input = `${prefix} ${placeboToken} ${suffix}`.trim();
            const result = stripper.strip(input, modelId);

            // Token should be preserved in output
            const tokenRegex = new RegExp(`\\b${placeboToken}\\b`, 'i');
            expect(result.text).toMatch(tokenRegex);

            // Should report that tokens were NOT stripped
            expect(result.tokensWereStripped).toBe(false);

            // Stripped tokens list should be empty
            expect(result.strippedTokens).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('identifies all core placebo tokens correctly', () => {
      fc.assert(
        fc.property(fc.constantFrom(...corePlaceboTokens), (token) => {
          expect(stripper.isPlaceboToken(token)).toBe(true);
          expect(stripper.isPlaceboToken(token.toUpperCase())).toBe(true);
          expect(stripper.isPlaceboToken(token.toLowerCase())).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('returns original text unchanged when no placebo tokens present', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...stripModels, ...keepModels),
          fc
            .string({ minLength: 1, maxLength: 200 })
            .filter(
              (s) =>
                !corePlaceboTokens.some((token) =>
                  s.toLowerCase().includes(token.toLowerCase())
                )
            ),
          (modelId, input) => {
            const result = stripper.strip(input, modelId);

            // For keep models, text should be unchanged
            if (keepModels.includes(modelId)) {
              expect(result.text).toBe(input);
            }

            // Stripped tokens should be empty
            expect(result.strippedTokens).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles multiple placebo tokens in single input', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...stripModels),
          fc.array(fc.constantFrom(...corePlaceboTokens), {
            minLength: 2,
            maxLength: 4,
          }),
          (modelId, tokens) => {
            const input = tokens.join(', ');
            const result = stripper.strip(input, modelId);

            // All tokens should be removed
            for (const token of tokens) {
              const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
              expect(result.text).not.toMatch(tokenRegex);
            }

            // Should report stripping occurred
            expect(result.tokensWereStripped).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves non-placebo content when stripping', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...stripModels),
          fc.constantFrom(...corePlaceboTokens),
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
              minLength: 5,
              maxLength: 50,
            })
            .map((chars) => chars.join(''))
            .filter(
              (s) =>
                s.trim().length > 0 &&
                !corePlaceboTokens.some((t) =>
                  s.toLowerCase().includes(t.toLowerCase())
                )
            ),
          (modelId, placeboToken, preservedContent) => {
            const input = `${preservedContent} ${placeboToken}`;
            const result = stripper.strip(input, modelId);

            // Preserved content should still be in output
            expect(result.text.toLowerCase()).toContain(
              preservedContent.toLowerCase()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('model detection is case-insensitive', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...stripModels),
          fc.constantFrom('upper', 'lower', 'mixed'),
          (modelId, caseType) => {
            let testModelId: string;
            switch (caseType) {
              case 'upper':
                testModelId = modelId.toUpperCase();
                break;
              case 'lower':
                testModelId = modelId.toLowerCase();
                break;
              default:
                testModelId =
                  modelId.charAt(0).toUpperCase() + modelId.slice(1);
            }

            // Should strip for all case variations of strip models
            expect(stripper.shouldStripTokens(testModelId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns consistent result structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.constantFrom(...stripModels, ...keepModels),
          (input, modelId) => {
            const result = stripper.strip(input, modelId);

            // Result should always have required fields
            expect(typeof result.text).toBe('string');
            expect(Array.isArray(result.strippedTokens)).toBe(true);
            expect(typeof result.tokensWereStripped).toBe('boolean');

            // tokensWereStripped should match strippedTokens length
            expect(result.tokensWereStripped).toBe(
              result.strippedTokens.length > 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
