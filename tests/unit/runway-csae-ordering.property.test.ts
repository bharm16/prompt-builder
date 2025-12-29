/**
 * Property-based tests for Runway CSAE Ordering
 *
 * Tests the following correctness property:
 * - Property 4: Runway CSAE Ordering
 *
 * For any Runway prompt containing camera, subject, action, and environment elements,
 * the transform phase SHALL produce output where camera terms appear before subject terms,
 * subject terms appear before action terms, and action terms appear before environment terms.
 *
 * @module runway-csae-ordering.property.test
 *
 * **Feature: video-model-optimization, Property 4: Runway CSAE Ordering**
 * **Validates: Requirements 3.3, 3.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { RunwayStrategy } from '@services/video-prompt-analysis/strategies/RunwayStrategy';

/**
 * Camera movement terms for generating test prompts
 */
const CAMERA_TERMS = [
  'pan left',
  'pan right',
  'tilt up',
  'tilt down',
  'dolly in',
  'dolly out',
  'zoom in',
  'zoom out',
  'tracking shot',
  'crane shot',
  'steadicam',
  'handheld',
  'low angle',
  'high angle',
  'wide angle',
  'telephoto',
] as const;

/**
 * Subject terms for generating test prompts
 */
const SUBJECT_TERMS = [
  'a man',
  'a woman',
  'a person',
  'a child',
  'a dog',
  'a cat',
  'the man',
  'the woman',
  'someone',
  'a figure',
  'a character',
] as const;

/**
 * Action terms for generating test prompts
 */
const ACTION_TERMS = [
  'walking',
  'running',
  'jumping',
  'sitting',
  'standing',
  'dancing',
  'talking',
  'looking',
  'holding',
  'reaching',
  'falling',
  'flying',
  'swimming',
  'driving',
] as const;

/**
 * Environment terms for generating test prompts
 */
const ENVIRONMENT_TERMS = [
  'in a forest',
  'in the city',
  'at the beach',
  'on a mountain',
  'in a room',
  'at a park',
  'in the desert',
  'on the street',
  'inside a building',
  'outside',
  'in the garden',
] as const;

/**
 * Find the position of a term in the prompt (case-insensitive)
 * Returns -1 if not found
 */
function findTermPosition(prompt: string, term: string): number {
  const lowerPrompt = prompt.toLowerCase();
  const lowerTerm = term.toLowerCase();
  return lowerPrompt.indexOf(lowerTerm);
}

/**
 * Find the earliest position of any term from a list
 * Returns -1 if none found
 */
function findEarliestPosition(prompt: string, terms: readonly string[]): number {
  let earliest = -1;

  for (const term of terms) {
    const pos = findTermPosition(prompt, term);
    if (pos !== -1 && (earliest === -1 || pos < earliest)) {
      earliest = pos;
    }
  }

  return earliest;
}

/**
 * Check if prompt contains any term from a list
 */
function containsAnyTerm(prompt: string, terms: readonly string[]): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return terms.some(term => lowerPrompt.includes(term.toLowerCase()));
}

describe('Runway CSAE Ordering Property Tests', () => {
  const strategy = new RunwayStrategy();

  /**
   * Property 4: Runway CSAE Ordering
   *
   * For any Runway prompt containing camera, subject, action, and environment elements,
   * the transform phase SHALL produce output where camera terms appear before subject terms,
   * subject terms appear before action terms, and action terms appear before environment terms.
   *
   * **Feature: video-model-optimization, Property 4: Runway CSAE Ordering**
   * **Validates: Requirements 3.3, 3.4**
   */
  describe('Property 4: Runway CSAE Ordering', () => {
    it('camera terms appear before subject terms in transformed output', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CAMERA_TERMS),
          fc.constantFrom(...SUBJECT_TERMS),
          fc.string({ minLength: 0, maxLength: 50 }),
          async (cameraTerm, subjectTerm, filler) => {
            // Create input with camera and subject in random order
            const inputs = [
              `${subjectTerm} ${filler} ${cameraTerm}`,
              `${cameraTerm} ${filler} ${subjectTerm}`,
              `${filler} ${subjectTerm} ${cameraTerm}`,
            ];

            for (const input of inputs) {
              // Run normalize first (required before transform)
              const normalized = strategy.normalize(input);
              const result = strategy.transform(normalized);
              const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

              // If both terms are present in output, camera should come first
              const cameraPos = findTermPosition(prompt, cameraTerm);
              const subjectPos = findTermPosition(prompt, subjectTerm);

              if (cameraPos !== -1 && subjectPos !== -1) {
                expect(cameraPos).toBeLessThan(subjectPos);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('camera terms are moved to absolute start when present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CAMERA_TERMS),
          fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (cameraTerm, otherContent) => {
            // Create input with camera term NOT at the start
            const input = `${otherContent} ${cameraTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Camera term should be near the start (within first 50 chars or first element)
            const cameraPos = findTermPosition(prompt, cameraTerm);

            if (cameraPos !== -1) {
              // Camera should be in the first portion of the prompt
              // Allow some flexibility for formatting
              const firstCommaPos = prompt.indexOf(',');
              const firstSegmentEnd = firstCommaPos !== -1 ? firstCommaPos : prompt.length;

              // Camera term should appear before or within the first segment
              expect(cameraPos).toBeLessThanOrEqual(firstSegmentEnd + cameraTerm.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('subject terms appear before action terms in transformed output', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SUBJECT_TERMS),
          fc.constantFrom(...ACTION_TERMS),
          fc.string({ minLength: 0, maxLength: 30 }),
          async (subjectTerm, actionTerm, filler) => {
            // Create input with subject and action
            const input = `${actionTerm} ${filler} ${subjectTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            const subjectPos = findTermPosition(prompt, subjectTerm);
            const actionPos = findTermPosition(prompt, actionTerm);

            // If both are present, subject should come before action
            if (subjectPos !== -1 && actionPos !== -1) {
              expect(subjectPos).toBeLessThan(actionPos);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('action terms appear before environment terms in transformed output', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...ACTION_TERMS),
          fc.constantFrom(...ENVIRONMENT_TERMS),
          fc.string({ minLength: 0, maxLength: 30 }),
          async (actionTerm, envTerm, filler) => {
            // Create input with action and environment in reverse order
            const input = `${envTerm} ${filler} ${actionTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            const actionPos = findTermPosition(prompt, actionTerm);
            const envPos = findTermPosition(prompt, envTerm);

            // If both are present, action should come before environment
            if (actionPos !== -1 && envPos !== -1) {
              expect(actionPos).toBeLessThan(envPos);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('full CSAE ordering is maintained with all four elements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CAMERA_TERMS),
          fc.constantFrom(...SUBJECT_TERMS),
          fc.constantFrom(...ACTION_TERMS),
          fc.constantFrom(...ENVIRONMENT_TERMS),
          async (cameraTerm, subjectTerm, actionTerm, envTerm) => {
            // Create input with all elements in reverse CSAE order (EASC)
            const input = `${envTerm}, ${actionTerm}, ${subjectTerm}, ${cameraTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            const cameraPos = findTermPosition(prompt, cameraTerm);
            const subjectPos = findTermPosition(prompt, subjectTerm);
            const actionPos = findTermPosition(prompt, actionTerm);
            const envPos = findTermPosition(prompt, envTerm);

            // All elements should be present
            expect(cameraPos).not.toBe(-1);

            // CSAE ordering: Camera < Subject < Action < Environment
            if (cameraPos !== -1 && subjectPos !== -1) {
              expect(cameraPos).toBeLessThan(subjectPos);
            }
            if (subjectPos !== -1 && actionPos !== -1) {
              expect(subjectPos).toBeLessThan(actionPos);
            }
            if (actionPos !== -1 && envPos !== -1) {
              expect(actionPos).toBeLessThan(envPos);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('depth terms are mapped to dolly camera motion', async () => {
      const depthTerms = ['depth', '3d feel', '3d effect', 'parallax'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...depthTerms),
          fc.constantFrom(...SUBJECT_TERMS),
          async (depthTerm, subjectTerm) => {
            const input = `${subjectTerm} with ${depthTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Should contain dolly camera motion
            expect(prompt.toLowerCase()).toContain('dolly');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('vertigo terms are mapped to zoom camera motion', async () => {
      const vertigoTerms = ['vertigo', 'compression', 'dolly zoom', 'zolly'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...vertigoTerms),
          fc.constantFrom(...SUBJECT_TERMS),
          async (vertigoTerm, subjectTerm) => {
            const input = `${subjectTerm} with ${vertigoTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Should contain zoom camera motion
            expect(prompt.toLowerCase()).toContain('zoom');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('CSAE Ordering Edge Cases', () => {
    it('handles prompts with only camera terms', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CAMERA_TERMS),
          async (cameraTerm) => {
            const input = cameraTerm;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);

            expect(result.prompt).not.toBeNull();
            expect(result.prompt).not.toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles prompts with no recognizable CSAE elements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 100 }).filter(s => {
            const lower = s.toLowerCase();
            // Filter out strings that contain CSAE terms
            return !CAMERA_TERMS.some(t => lower.includes(t.toLowerCase())) &&
                   !SUBJECT_TERMS.some(t => lower.includes(t.toLowerCase())) &&
                   !ACTION_TERMS.some(t => lower.includes(t.toLowerCase())) &&
                   !ENVIRONMENT_TERMS.some(t => lower.includes(t.toLowerCase()));
          }),
          async (input) => {
            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);

            // Should still produce valid output
            expect(result.prompt).not.toBeNull();
            expect(result.metadata).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves semantic content during CSAE reordering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CAMERA_TERMS),
          fc.constantFrom(...SUBJECT_TERMS),
          fc.constantFrom(...ACTION_TERMS),
          async (cameraTerm, subjectTerm, actionTerm) => {
            const input = `${actionTerm} ${subjectTerm} ${cameraTerm}`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);
            const lowerPrompt = prompt.toLowerCase();

            // All original terms should still be present (possibly reordered)
            expect(lowerPrompt).toContain(cameraTerm.toLowerCase());
            expect(lowerPrompt).toContain(subjectTerm.toLowerCase());
            expect(lowerPrompt).toContain(actionTerm.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
