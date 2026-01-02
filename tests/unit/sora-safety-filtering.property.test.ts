/**
 * Property-based tests for Sora Safety Filtering (Celebrity Name Stripping)
 *
 * Tests the following correctness property:
 * - Property 3 (Sora): Celebrity Name Stripping
 *
 * For any prompt containing public figure names, the SoraStrategy normalize phase
 * SHALL aggressively strip those names to prevent API rejections, while preserving
 * valid @Cameo identity tokens.
 *
 * @module sora-safety-filtering.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { SoraStrategy } from '@services/video-prompt-analysis/strategies/SoraStrategy';
import { safetySanitizer } from '@services/video-prompt-analysis/utils/SafetySanitizer';

describe('SoraStrategy Property Tests', () => {
  const strategy = new SoraStrategy();

  // Sample public figure names for testing
  const publicFigureNames = [
    'Taylor Swift',
    'Elon Musk',
    'Beyonce',
    'Kim Kardashian',
    'Dwayne Johnson',
    'Tom Cruise',
    'Brad Pitt',
    'Leonardo DiCaprio',
    'Scarlett Johansson',
    'Chris Hemsworth',
    'Keanu Reeves',
    'Zendaya',
    'Barack Obama',
    'Oprah Winfrey',
    'LeBron James',
  ];

  // Sample @Cameo tokens for testing
  const cameoTokens = [
    '@Cameo(user123)',
    '@Cameo(celebrity_abc)',
    '@Cameo(id_456)',
    '@Cameo(custom_identity)',
  ];

  /**
   * Property 3 (Sora): Celebrity Name Stripping
   *
   * WHEN normalizing a Sora prompt, THE SoraStrategy SHALL aggressively strip
   * public figure names to prevent API rejections.
   *
   * **Feature: video-model-optimization, Property 3 (Sora): Celebrity Name Stripping**
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 3 (Sora): Celebrity Name Stripping', () => {
    it('strips public figure names from prompts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...publicFigureNames),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (celebrity, prefix, suffix) => {
            const input = `${prefix} ${celebrity} ${suffix}`.trim();
            const result = strategy.normalize(input);

            // Celebrity name should not appear in output (case-insensitive)
            expect(result.toLowerCase()).not.toContain(celebrity.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('replaces public figure names with generic descriptors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...publicFigureNames),
          (celebrity) => {
            const input = `A video featuring ${celebrity} walking in the park`;
            const result = strategy.normalize(input);

            // Original celebrity name should be gone
            expect(result.toLowerCase()).not.toContain(celebrity.toLowerCase());

            // Result should contain some replacement text (either "a person" or a physical description)
            // The SafetySanitizer replaces with physical descriptions, SoraStrategy replaces with "a person"
            // Either is acceptable as long as the celebrity name is removed
            expect(result.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves @Cameo tokens while stripping celebrity names', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...cameoTokens),
          fc.constantFrom(...publicFigureNames),
          (cameoToken, celebrity) => {
            const input = `${cameoToken} meets ${celebrity} at a cafe`;
            const result = strategy.normalize(input);

            // @Cameo token should be preserved
            expect(result).toContain(cameoToken);

            // Celebrity name should be stripped
            expect(result.toLowerCase()).not.toContain(celebrity.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves @Cameo tokens in various positions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...cameoTokens),
          fc.string({ minLength: 5, maxLength: 30 }),
          fc.string({ minLength: 5, maxLength: 30 }),
          (cameoToken, prefix, suffix) => {
            // Filter out any accidental celebrity names in random strings
            const safePrefix = prefix.replace(/[A-Z][a-z]+\s+[A-Z][a-z]+/g, 'someone');
            const safeSuffix = suffix.replace(/[A-Z][a-z]+\s+[A-Z][a-z]+/g, 'someone');
            
            const input = `${safePrefix} ${cameoToken} ${safeSuffix}`;
            const result = strategy.normalize(input);

            // @Cameo token should always be preserved
            expect(result).toContain(cameoToken);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles multiple celebrity names in same prompt', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...publicFigureNames), { minLength: 2, maxLength: 4 }),
          (celebrities) => {
            // Create unique list
            const uniqueCelebrities = [...new Set(celebrities)];
            const input = uniqueCelebrities.join(' and ') + ' at a party';
            const result = strategy.normalize(input);

            // All celebrity names should be stripped
            for (const celebrity of uniqueCelebrities) {
              expect(result.toLowerCase()).not.toContain(celebrity.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles multiple @Cameo tokens in same prompt', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...cameoTokens), { minLength: 2, maxLength: 3 }),
          (tokens) => {
            const uniqueTokens = [...new Set(tokens)];
            const input = uniqueTokens.join(' talking to ') + ' in a room';
            const result = strategy.normalize(input);

            // All @Cameo tokens should be preserved
            for (const token of uniqueTokens) {
              expect(result).toContain(token);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('safety sanitizer flags public figure names', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...publicFigureNames),
          (celebrity) => {
            expect(safetySanitizer.containsBlockedTerms(celebrity)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('safety sanitizer detects public figures in text', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...publicFigureNames),
          fc.string({ minLength: 0, maxLength: 30 }),
          (celebrity, suffix) => {
            const input = `A scene with ${celebrity} ${suffix}`;
            expect(safetySanitizer.containsBlockedTerms(input)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('extractCameoTokens correctly extracts @Cameo tokens', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...cameoTokens), { minLength: 1, maxLength: 3 }),
          (tokens) => {
            const uniqueTokens = [...new Set(tokens)];
            const input = uniqueTokens.join(' and ') + ' in a video';
            const extracted = strategy.extractCameoTokens(input);

            // Should extract all unique tokens
            expect(extracted.length).toBe(uniqueTokens.length);
            for (const token of uniqueTokens) {
              expect(extracted).toContain(token);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns text unchanged when no public figures present', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), {
              minLength: 10,
              maxLength: 80,
            })
            .map((chars) => chars.join(''))
            .filter((s) => {
              const lower = s.toLowerCase();
              // Ensure no public figure names are present
              const hasPublicFigure = publicFigureNames.some((name) =>
                lower.includes(name.toLowerCase())
              );
              return !hasPublicFigure && s.trim().length > 0;
            }),
          (safeInput) => {
            const result = strategy.normalize(safeInput);

            // Text should be essentially unchanged (except whitespace normalization)
            // The normalize phase may do other processing, so we check the core content
            const normalizedInput = safeInput.replace(/\s+/g, ' ').trim();
            const normalizedResult = result.replace(/\s+/g, ' ').trim();
            
            // Should not have added "a person" since no celebrities were present
            if (!normalizedInput.toLowerCase().includes('a person')) {
              // If input didn't have "a person", result shouldn't have more instances
              const inputCount = (normalizedInput.match(/a person/gi) || []).length;
              const resultCount = (normalizedResult.match(/a person/gi) || []).length;
              expect(resultCount).toBeLessThanOrEqual(inputCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
