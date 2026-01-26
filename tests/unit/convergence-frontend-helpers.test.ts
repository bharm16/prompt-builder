/**
 * Unit tests for convergence helper functions
 *
 * Tests the helper functions used for navigation through the convergence flow.
 *
 * Requirements tested:
 * - 3.5: Process dimensions in order: mood → framing → lighting → camera_motion
 * - 13.1-13.7: Support back navigation
 * - 18.1-18.5: Progress indicator navigation
 *
 * Task: 33.4 Test helper functions (getNextStep, getDimensionOrder, etc.)
 *
 * @module convergence-frontend-helpers.test
 */

import { describe, it, expect } from 'vitest';
import {
  STEP_ORDER,
  DIMENSION_ORDER,
  getStepOrder,
  getNextStep,
  getPreviousStep,
  getDimensionOrder,
  getNextDimension,
  getPreviousDimension,
  stepToDimension,
  dimensionToStep,
  isDimensionStep,
  getRequiredLockedDimensions,
  getStepLabel,
  isStepBefore,
  isStepAfter,
  getProgressSteps,
} from '@features/convergence/utils/helpers';
import type { ConvergenceStep, DimensionType } from '@features/convergence/types';

// ============================================================================
// Tests
// ============================================================================

describe('Convergence Helper Functions', () => {
  describe('Constants', () => {
    describe('STEP_ORDER', () => {
      it('should have correct step order', () => {
        expect(STEP_ORDER).toEqual([
          'intent',
          'direction',
          'mood',
          'framing',
          'lighting',
          'camera_motion',
          'subject_motion',
          'preview',
          'complete',
        ]);
      });

      it('should have 9 steps', () => {
        expect(STEP_ORDER).toHaveLength(9);
      });
    });

    describe('DIMENSION_ORDER', () => {
      it('should have correct dimension order', () => {
        expect(DIMENSION_ORDER).toEqual([
          'direction',
          'mood',
          'framing',
          'lighting',
          'camera_motion',
        ]);
      });

      it('should have 5 dimensions', () => {
        expect(DIMENSION_ORDER).toHaveLength(5);
      });
    });
  });


  describe('Step Navigation Functions', () => {
    describe('getStepOrder', () => {
      it('should return correct index for each step', () => {
        expect(getStepOrder('intent')).toBe(0);
        expect(getStepOrder('direction')).toBe(1);
        expect(getStepOrder('mood')).toBe(2);
        expect(getStepOrder('framing')).toBe(3);
        expect(getStepOrder('lighting')).toBe(4);
        expect(getStepOrder('camera_motion')).toBe(5);
        expect(getStepOrder('subject_motion')).toBe(6);
        expect(getStepOrder('preview')).toBe(7);
        expect(getStepOrder('complete')).toBe(8);
      });

      it('should return -1 for invalid step', () => {
        // @ts-expect-error - Testing invalid step
        expect(getStepOrder('invalid')).toBe(-1);
      });
    });

    describe('getNextStep', () => {
      it('should return next step for each step', () => {
        expect(getNextStep('intent')).toBe('direction');
        expect(getNextStep('direction')).toBe('mood');
        expect(getNextStep('mood')).toBe('framing');
        expect(getNextStep('framing')).toBe('lighting');
        expect(getNextStep('lighting')).toBe('camera_motion');
        expect(getNextStep('camera_motion')).toBe('subject_motion');
        expect(getNextStep('subject_motion')).toBe('preview');
        expect(getNextStep('preview')).toBe('complete');
      });

      it('should return complete for last step', () => {
        expect(getNextStep('complete')).toBe('complete');
      });
    });

    describe('getPreviousStep', () => {
      it('should return previous step for each step', () => {
        expect(getPreviousStep('complete')).toBe('preview');
        expect(getPreviousStep('preview')).toBe('subject_motion');
        expect(getPreviousStep('subject_motion')).toBe('camera_motion');
        expect(getPreviousStep('camera_motion')).toBe('lighting');
        expect(getPreviousStep('lighting')).toBe('framing');
        expect(getPreviousStep('framing')).toBe('mood');
        expect(getPreviousStep('mood')).toBe('direction');
        expect(getPreviousStep('direction')).toBe('intent');
      });

      it('should return intent for first step', () => {
        expect(getPreviousStep('intent')).toBe('intent');
      });
    });
  });

  describe('Dimension Navigation Functions', () => {
    describe('getDimensionOrder', () => {
      it('should return correct index for each dimension', () => {
        expect(getDimensionOrder('direction')).toBe(0);
        expect(getDimensionOrder('mood')).toBe(1);
        expect(getDimensionOrder('framing')).toBe(2);
        expect(getDimensionOrder('lighting')).toBe(3);
        expect(getDimensionOrder('camera_motion')).toBe(4);
      });

      it('should return -1 for invalid dimension', () => {
        // @ts-expect-error - Testing invalid dimension
        expect(getDimensionOrder('invalid')).toBe(-1);
      });
    });

    describe('getNextDimension', () => {
      it('should return next dimension for each dimension', () => {
        expect(getNextDimension('direction')).toBe('mood');
        expect(getNextDimension('mood')).toBe('framing');
        expect(getNextDimension('framing')).toBe('lighting');
        expect(getNextDimension('lighting')).toBe('camera_motion');
      });

      it('should return null for last dimension', () => {
        expect(getNextDimension('camera_motion')).toBeNull();
      });
    });

    describe('getPreviousDimension', () => {
      it('should return previous dimension for each dimension', () => {
        expect(getPreviousDimension('camera_motion')).toBe('lighting');
        expect(getPreviousDimension('lighting')).toBe('framing');
        expect(getPreviousDimension('framing')).toBe('mood');
        expect(getPreviousDimension('mood')).toBe('direction');
      });

      it('should return null for first dimension', () => {
        expect(getPreviousDimension('direction')).toBeNull();
      });
    });
  });


  describe('Step/Dimension Conversion Functions', () => {
    describe('stepToDimension', () => {
      it('should convert dimension steps to dimensions', () => {
        expect(stepToDimension('direction')).toBe('direction');
        expect(stepToDimension('mood')).toBe('mood');
        expect(stepToDimension('framing')).toBe('framing');
        expect(stepToDimension('lighting')).toBe('lighting');
        expect(stepToDimension('camera_motion')).toBe('camera_motion');
      });

      it('should return null for non-dimension steps', () => {
        expect(stepToDimension('intent')).toBeNull();
        expect(stepToDimension('subject_motion')).toBeNull();
        expect(stepToDimension('preview')).toBeNull();
        expect(stepToDimension('complete')).toBeNull();
      });
    });

    describe('dimensionToStep', () => {
      it('should convert dimensions to steps', () => {
        expect(dimensionToStep('direction')).toBe('direction');
        expect(dimensionToStep('mood')).toBe('mood');
        expect(dimensionToStep('framing')).toBe('framing');
        expect(dimensionToStep('lighting')).toBe('lighting');
        expect(dimensionToStep('camera_motion')).toBe('camera_motion');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('isDimensionStep', () => {
      it('should return true for dimension steps', () => {
        expect(isDimensionStep('direction')).toBe(true);
        expect(isDimensionStep('mood')).toBe(true);
        expect(isDimensionStep('framing')).toBe(true);
        expect(isDimensionStep('lighting')).toBe(true);
        expect(isDimensionStep('camera_motion')).toBe(true);
      });

      it('should return false for non-dimension steps', () => {
        expect(isDimensionStep('intent')).toBe(false);
        expect(isDimensionStep('subject_motion')).toBe(false);
        expect(isDimensionStep('preview')).toBe(false);
        expect(isDimensionStep('complete')).toBe(false);
      });
    });

    describe('getRequiredLockedDimensions', () => {
      it('should return empty array for intent step', () => {
        expect(getRequiredLockedDimensions('intent')).toEqual([]);
      });

      it('should return empty array for direction step', () => {
        expect(getRequiredLockedDimensions('direction')).toEqual([]);
      });

      it('should return direction for mood step', () => {
        expect(getRequiredLockedDimensions('mood')).toEqual(['direction']);
      });

      it('should return direction and mood for framing step', () => {
        expect(getRequiredLockedDimensions('framing')).toEqual(['direction', 'mood']);
      });

      it('should return direction, mood, framing for lighting step', () => {
        expect(getRequiredLockedDimensions('lighting')).toEqual([
          'direction',
          'mood',
          'framing',
        ]);
      });

      it('should return all dimensions except camera_motion for camera_motion step', () => {
        expect(getRequiredLockedDimensions('camera_motion')).toEqual([
          'direction',
          'mood',
          'framing',
          'lighting',
        ]);
      });

      it('should return all dimensions for subject_motion step', () => {
        expect(getRequiredLockedDimensions('subject_motion')).toEqual([
          'direction',
          'mood',
          'framing',
          'lighting',
          'camera_motion',
        ]);
      });

      it('should return all dimensions for preview step', () => {
        expect(getRequiredLockedDimensions('preview')).toEqual([
          'direction',
          'mood',
          'framing',
          'lighting',
          'camera_motion',
        ]);
      });
    });

    describe('getStepLabel', () => {
      it('should return correct labels for all steps', () => {
        expect(getStepLabel('intent')).toBe('Intent');
        expect(getStepLabel('direction')).toBe('Direction');
        expect(getStepLabel('mood')).toBe('Mood');
        expect(getStepLabel('framing')).toBe('Framing');
        expect(getStepLabel('lighting')).toBe('Lighting');
        expect(getStepLabel('camera_motion')).toBe('Camera');
        expect(getStepLabel('subject_motion')).toBe('Motion');
        expect(getStepLabel('preview')).toBe('Preview');
        expect(getStepLabel('complete')).toBe('Complete');
      });
    });

    describe('isStepBefore', () => {
      it('should return true when step is before reference', () => {
        expect(isStepBefore('intent', 'direction')).toBe(true);
        expect(isStepBefore('direction', 'mood')).toBe(true);
        expect(isStepBefore('mood', 'preview')).toBe(true);
        expect(isStepBefore('intent', 'complete')).toBe(true);
      });

      it('should return false when step is after reference', () => {
        expect(isStepBefore('direction', 'intent')).toBe(false);
        expect(isStepBefore('mood', 'direction')).toBe(false);
        expect(isStepBefore('complete', 'intent')).toBe(false);
      });

      it('should return false when step equals reference', () => {
        expect(isStepBefore('mood', 'mood')).toBe(false);
        expect(isStepBefore('direction', 'direction')).toBe(false);
      });
    });

    describe('isStepAfter', () => {
      it('should return true when step is after reference', () => {
        expect(isStepAfter('direction', 'intent')).toBe(true);
        expect(isStepAfter('mood', 'direction')).toBe(true);
        expect(isStepAfter('preview', 'mood')).toBe(true);
        expect(isStepAfter('complete', 'intent')).toBe(true);
      });

      it('should return false when step is before reference', () => {
        expect(isStepAfter('intent', 'direction')).toBe(false);
        expect(isStepAfter('direction', 'mood')).toBe(false);
        expect(isStepAfter('intent', 'complete')).toBe(false);
      });

      it('should return false when step equals reference', () => {
        expect(isStepAfter('mood', 'mood')).toBe(false);
        expect(isStepAfter('direction', 'direction')).toBe(false);
      });
    });

    describe('getProgressSteps', () => {
      it('should return steps visible in progress indicator', () => {
        const progressSteps = getProgressSteps();

        expect(progressSteps).toEqual([
          'direction',
          'mood',
          'framing',
          'lighting',
          'camera_motion',
          'subject_motion',
          'preview',
        ]);
      });

      it('should not include intent step', () => {
        const progressSteps = getProgressSteps();
        expect(progressSteps).not.toContain('intent');
      });

      it('should not include complete step', () => {
        const progressSteps = getProgressSteps();
        expect(progressSteps).not.toContain('complete');
      });

      it('should have 7 steps', () => {
        expect(getProgressSteps()).toHaveLength(7);
      });
    });
  });


  describe('Navigation Flow Consistency', () => {
    it('should have consistent forward navigation through all steps', () => {
      let currentStep: ConvergenceStep = 'intent';
      const visitedSteps: ConvergenceStep[] = [currentStep];

      while (currentStep !== 'complete') {
        currentStep = getNextStep(currentStep);
        visitedSteps.push(currentStep);
      }

      expect(visitedSteps).toEqual(STEP_ORDER);
    });

    it('should have consistent backward navigation through all steps', () => {
      let currentStep: ConvergenceStep = 'complete';
      const visitedSteps: ConvergenceStep[] = [currentStep];

      while (currentStep !== 'intent') {
        currentStep = getPreviousStep(currentStep);
        visitedSteps.push(currentStep);
      }

      expect(visitedSteps).toEqual([...STEP_ORDER].reverse());
    });

    it('should have consistent forward navigation through dimensions', () => {
      let currentDimension: DimensionType | 'direction' | null = 'direction';
      const visitedDimensions: Array<DimensionType | 'direction'> = [currentDimension];

      while (currentDimension !== null) {
        currentDimension = getNextDimension(currentDimension);
        if (currentDimension !== null) {
          visitedDimensions.push(currentDimension);
        }
      }

      expect(visitedDimensions).toEqual([...DIMENSION_ORDER]);
    });

    it('should have consistent backward navigation through dimensions', () => {
      let currentDimension: DimensionType | 'direction' | null = 'camera_motion';
      const visitedDimensions: Array<DimensionType | 'direction'> = [currentDimension];

      while (currentDimension !== null) {
        currentDimension = getPreviousDimension(currentDimension);
        if (currentDimension !== null) {
          visitedDimensions.push(currentDimension);
        }
      }

      expect(visitedDimensions).toEqual([...DIMENSION_ORDER].reverse());
    });

    it('should maintain step order consistency with dimension order', () => {
      // Each dimension should map to a step at the same relative position
      for (const dimension of DIMENSION_ORDER) {
        const step = dimensionToStep(dimension);
        const stepIndex = getStepOrder(step);
        const dimensionIndex = getDimensionOrder(dimension);

        // Step index should be dimensionIndex + 1 (because 'intent' is step 0)
        expect(stepIndex).toBe(dimensionIndex + 1);
      }
    });

    it('should have bidirectional step-dimension conversion', () => {
      for (const dimension of DIMENSION_ORDER) {
        const step = dimensionToStep(dimension);
        const backToDimension = stepToDimension(step);
        expect(backToDimension).toBe(dimension);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle all step types in getStepLabel', () => {
      for (const step of STEP_ORDER) {
        const label = getStepLabel(step);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('should handle all dimension types in getDimensionOrder', () => {
      for (const dimension of DIMENSION_ORDER) {
        const order = getDimensionOrder(dimension);
        expect(order).toBeGreaterThanOrEqual(0);
        expect(order).toBeLessThan(DIMENSION_ORDER.length);
      }
    });

    it('should handle all step types in getStepOrder', () => {
      for (const step of STEP_ORDER) {
        const order = getStepOrder(step);
        expect(order).toBeGreaterThanOrEqual(0);
        expect(order).toBeLessThan(STEP_ORDER.length);
      }
    });
  });
});
