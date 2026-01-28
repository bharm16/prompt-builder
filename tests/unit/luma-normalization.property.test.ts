/**
 * Property-based tests for Luma Normalization Token Stripping
 *
 * Tests the following correctness property:
 * - Property 3 (Luma): Normalization Token Stripping
 *
 * For any Luma prompt with loop:true API parameter active, the normalize phase
 * SHALL strip "loop" and "seamless" terms.
 *
 * @module luma-normalization.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { LumaStrategy } from '@services/video-prompt-analysis/strategies/LumaStrategy';
import type { PromptContext } from '@services/video-prompt-analysis/strategies';

describe('Luma Normalization Property Tests', () => {
  const strategy = new LumaStrategy();

  // Loop terms that should be stripped when loop:true
  const loopTerms = [
    'loop',
    'looping',
    'looped',
    'seamless',
    'seamlessly',
    'infinite',
    'continuous loop',
    'perfect loop',
    'endless',
  ];

  /**
   * Property 3 (Luma): Normalization Token Stripping
   *
   * For any Luma prompt with loop:true API parameter active,
   * the normalize phase SHALL strip "loop" and "seamless" terms.
   *
   * **Feature: video-model-optimization, Property 3 (Luma): Normalization Token Stripping**
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 3 (Luma): Normalization Token Stripping', () => {
    it('strips loop terms when loop:true is active', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...loopTerms),
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !loopTerms.some(t => s.toLowerCase().includes(t.toLowerCase()))),
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !loopTerms.some(t => s.toLowerCase().includes(t.toLowerCase()))),
          (loopTerm, prefix, suffix) => {
            const input = `${prefix} ${loopTerm} ${suffix}`.trim();
            const context: PromptContext = {
              userIntent: 'test',
              apiParams: { loop: true },
            };

            const result = strategy.normalize(input, context);

            // Loop term should be removed from output
            const termRegex = new RegExp(`\\b${loopTerm}\\b`, 'i');
            expect(result).not.toMatch(termRegex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves loop terms when loop:false or not set', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...loopTerms),
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !loopTerms.some(t => s.toLowerCase().includes(t.toLowerCase()))),
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !loopTerms.some(t => s.toLowerCase().includes(t.toLowerCase()))),
          fc.constantFrom(false, undefined),
          (loopTerm, prefix, suffix, loopValue) => {
            const input = `${prefix} ${loopTerm} ${suffix}`.trim();
            const context: PromptContext = {
              userIntent: 'test',
              apiParams: loopValue !== undefined ? { loop: loopValue } : {},
            };

            const result = strategy.normalize(input, context);

            // Loop term should be preserved in output
            const termRegex = new RegExp(`\\b${loopTerm}\\b`, 'i');
            expect(result).toMatch(termRegex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves non-loop content', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
            minLength: 5,
            maxLength: 30,
          })
            .map(chars => chars.join(''))
            .filter(s => 
              s.trim().length > 0 &&
              !loopTerms.some(t => s.toLowerCase().includes(t.toLowerCase()))
            ),
          fc.constantFrom(...loopTerms),
          fc.boolean(),
          (preservedContent, loopTerm, loopActive) => {
            const input = `${preservedContent} ${loopTerm}`;
            const context: PromptContext = {
              userIntent: 'test',
              apiParams: { loop: loopActive },
            };

            const result = strategy.normalize(input, context);

            // Preserved content should still be in output
            expect(result.toLowerCase()).toContain(preservedContent.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles multiple loop terms in single input', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...loopTerms), { minLength: 1, maxLength: 3 }),
          (loopTokens) => {
            const input = loopTokens.join(', ');
            const context: PromptContext = {
              userIntent: 'test',
              apiParams: { loop: true },
            };

            const result = strategy.normalize(input, context);

            // All loop tokens should be removed
            for (const token of loopTokens) {
              const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
              expect(result).not.toMatch(tokenRegex);
            }

          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns valid string output for any input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.boolean(),
          (input, loopActive) => {
            const context: PromptContext = {
              userIntent: 'test',
              apiParams: { loop: loopActive },
            };

            const result = strategy.normalize(input, context);

            // Result should always be a string
            expect(typeof result).toBe('string');

            // Result should not have excessive whitespace
            expect(result).not.toMatch(/\s{3,}/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('is case-insensitive for loop term detection', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...loopTerms),
          fc.constantFrom('upper', 'lower', 'mixed'),
          (loopTerm, caseType) => {
            let testTerm: string;
            switch (caseType) {
              case 'upper':
                testTerm = loopTerm.toUpperCase();
                break;
              case 'lower':
                testTerm = loopTerm.toLowerCase();
                break;
              default:
                testTerm = loopTerm.charAt(0).toUpperCase() + loopTerm.slice(1).toLowerCase();
            }

            const input = `video with ${testTerm} effect`;
            const context: PromptContext = {
              userIntent: 'test',
              apiParams: { loop: true },
            };

            const result = strategy.normalize(input, context);

            // Term should be stripped regardless of case
            const termRegex = new RegExp(`\\b${loopTerm}\\b`, 'i');
            expect(result).not.toMatch(termRegex);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
