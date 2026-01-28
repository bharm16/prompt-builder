import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  validatePrompt,
  calculateFilledByGroup,
  calculateGroupProgress,
} from '../validation';
import { PRIMARY_ELEMENT_KEYS, ELEMENT_GROUPS } from '../../config/constants';

describe('validation utilities', () => {
  const emptyElements = Object.fromEntries(
    PRIMARY_ELEMENT_KEYS.map((key) => [key, ''])
  ) as Record<string, string>;

  describe('error handling', () => {
    it('adds conflict feedback and skips conflict-free bonus when conflicts exist', () => {
      const elements = {
        ...emptyElements,
        subject: 'a detailed subject',
        action: 'doing something',
      };

      const result = validatePrompt(elements, [{ message: 'Conflict' }]);

      expect(result.feedback).toContain('Resolve conflicts for better coherence');
      expect(result.score).toBeLessThan(40);
    });

    it('reduces score compared to conflict-free baseline when conflicts are present', () => {
      const baseline = validatePrompt(emptyElements, []).score;
      const withConflicts = validatePrompt(emptyElements, [{ message: 'Conflict' }]).score;

      expect(withConflicts).toBeLessThan(baseline);
    });

    it('keeps score within 0-100 for any element inputs', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.string()),
          (randomElements) => {
            const result = validatePrompt(randomElements, []);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('edge cases', () => {
    it('scores empty prompt with conflict-free bonus and core feedback', () => {
      const result = validatePrompt(emptyElements, []);

      expect(result.score).toBe(20);
      expect(result.feedback).toContain(`Fill ${ELEMENT_GROUPS.core.length} more core elements`);
    });

    it('calculates group progress labels and totals', () => {
      const groupProgress = calculateGroupProgress({
        subject: 'hero',
        action: '',
        location: '',
      });

      const coreGroup = groupProgress.find((group) => group.key === 'core');
      expect(coreGroup?.label).toBe('Core');
      expect(coreGroup?.total).toBe(ELEMENT_GROUPS.core.length);
      expect(coreGroup?.filled).toBe(1);
    });
  });

  describe('core behavior', () => {
    it('reaches max score when all primary elements are detailed and conflict-free', () => {
      const detailedElements = Object.fromEntries(
        PRIMARY_ELEMENT_KEYS.map((key) => [key, 'a richly detailed value'])
      ) as Record<string, string>;

      const result = validatePrompt(detailedElements, []);

      expect(result.score).toBe(100);
      expect(result.feedback).toContain('Good visual definition!');
    });

    it('counts filled elements by group accurately', () => {
      const filledByGroup = calculateFilledByGroup({
        subject: 'cat',
        action: 'jumping',
        location: '',
        cameraMovement: 'dolly',
        mood: 'tense',
      });

      expect(filledByGroup.core).toBe(2);
      expect(filledByGroup.camera).toBe(1);
      expect(filledByGroup.atmosphere).toBe(1);
    });
  });
});
