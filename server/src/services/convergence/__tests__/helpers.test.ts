import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  withRetry,
  sleep,
} from '../helpers';
import type { ConvergenceStep, DimensionType } from '../types';

describe('STEP_ORDER constant', () => {
  it('has the correct number of steps', () => {
    expect(STEP_ORDER).toHaveLength(11);
  });

  it('starts with intent step', () => {
    expect(STEP_ORDER[0]).toBe('intent');
  });

  it('ends with complete step', () => {
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe('complete');
  });

  it('contains all expected steps in order', () => {
    expect(STEP_ORDER).toEqual([
      'intent',
      'starting_point',
      'direction',
      'mood',
      'framing',
      'lighting',
      'final_frame',
      'camera_motion',
      'subject_motion',
      'preview',
      'complete',
    ]);
  });
});

describe('DIMENSION_ORDER constant', () => {
  it('has the correct number of dimensions', () => {
    expect(DIMENSION_ORDER).toHaveLength(5);
  });

  it('starts with direction', () => {
    expect(DIMENSION_ORDER[0]).toBe('direction');
  });

  it('ends with camera_motion', () => {
    expect(DIMENSION_ORDER[DIMENSION_ORDER.length - 1]).toBe('camera_motion');
  });
});

describe('getStepOrder', () => {
  describe('error handling', () => {
    it('returns -1 for unknown step', () => {
      expect(getStepOrder('unknown' as ConvergenceStep)).toBe(-1);
    });

    it('returns -1 for empty string', () => {
      expect(getStepOrder('' as ConvergenceStep)).toBe(-1);
    });
  });

  describe('core behavior', () => {
    it('returns 0 for intent (first step)', () => {
      expect(getStepOrder('intent')).toBe(0);
    });

    it('returns correct index for middle steps', () => {
      expect(getStepOrder('mood')).toBe(3);
      expect(getStepOrder('framing')).toBe(4);
      expect(getStepOrder('lighting')).toBe(5);
    });

    it('returns 10 for complete (last step)', () => {
      expect(getStepOrder('complete')).toBe(10);
    });

    it('returns correct index for all steps', () => {
      STEP_ORDER.forEach((step, index) => {
        expect(getStepOrder(step)).toBe(index);
      });
    });
  });
});

describe('getNextStep', () => {
  describe('edge cases', () => {
    it('returns complete for complete step', () => {
      expect(getNextStep('complete')).toBe('complete');
    });

    it('returns complete for preview step (one before complete)', () => {
      expect(getNextStep('preview')).toBe('complete');
    });
  });

  describe('core behavior', () => {
    it('returns starting_point for intent', () => {
      expect(getNextStep('intent')).toBe('starting_point');
    });

    it('returns direction for starting_point', () => {
      expect(getNextStep('starting_point')).toBe('direction');
    });

    it('returns correct next for all steps except complete', () => {
      for (let i = 0; i < STEP_ORDER.length - 1; i++) {
        const current = STEP_ORDER[i]!;
        const next = STEP_ORDER[i + 1]!;
        expect(getNextStep(current)).toBe(next);
      }
    });
  });
});

describe('getPreviousStep', () => {
  describe('edge cases', () => {
    it('returns intent for intent (first step)', () => {
      expect(getPreviousStep('intent')).toBe('intent');
    });

    it('returns intent for unknown step', () => {
      expect(getPreviousStep('unknown' as ConvergenceStep)).toBe('intent');
    });
  });

  describe('core behavior', () => {
    it('returns intent for starting_point', () => {
      expect(getPreviousStep('starting_point')).toBe('intent');
    });

    it('returns preview for complete', () => {
      expect(getPreviousStep('complete')).toBe('preview');
    });

    it('returns correct previous for all steps except intent', () => {
      for (let i = 1; i < STEP_ORDER.length; i++) {
        const current = STEP_ORDER[i] as ConvergenceStep;
        const prev = STEP_ORDER[i - 1] as ConvergenceStep;
        expect(getPreviousStep(current)).toBe(prev);
      }
    });
  });
});

describe('getDimensionOrder', () => {
  describe('error handling', () => {
    it('returns -1 for unknown dimension', () => {
      expect(getDimensionOrder('unknown' as DimensionType)).toBe(-1);
    });
  });

  describe('core behavior', () => {
    it('returns 0 for direction', () => {
      expect(getDimensionOrder('direction')).toBe(0);
    });

    it('returns correct index for all dimensions', () => {
      DIMENSION_ORDER.forEach((dim, index) => {
        expect(getDimensionOrder(dim)).toBe(index);
      });
    });
  });
});

describe('getNextDimension', () => {
  describe('edge cases', () => {
    it('returns null for camera_motion (last dimension)', () => {
      expect(getNextDimension('camera_motion')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns mood for direction', () => {
      expect(getNextDimension('direction')).toBe('mood');
    });

    it('returns framing for mood', () => {
      expect(getNextDimension('mood')).toBe('framing');
    });

    it('returns lighting for framing', () => {
      expect(getNextDimension('framing')).toBe('lighting');
    });

    it('returns camera_motion for lighting', () => {
      expect(getNextDimension('lighting')).toBe('camera_motion');
    });
  });
});

describe('getPreviousDimension', () => {
  describe('edge cases', () => {
    it('returns null for direction (first dimension)', () => {
      expect(getPreviousDimension('direction')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns direction for mood', () => {
      expect(getPreviousDimension('mood')).toBe('direction');
    });

    it('returns mood for framing', () => {
      expect(getPreviousDimension('framing')).toBe('mood');
    });

    it('returns framing for lighting', () => {
      expect(getPreviousDimension('lighting')).toBe('framing');
    });

    it('returns lighting for camera_motion', () => {
      expect(getPreviousDimension('camera_motion')).toBe('lighting');
    });
  });
});

describe('stepToDimension', () => {
  describe('error handling', () => {
    it('returns null for non-dimension steps', () => {
      expect(stepToDimension('intent')).toBeNull();
      expect(stepToDimension('starting_point')).toBeNull();
      expect(stepToDimension('final_frame')).toBeNull();
      expect(stepToDimension('subject_motion')).toBeNull();
      expect(stepToDimension('preview')).toBeNull();
      expect(stepToDimension('complete')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns direction for direction step', () => {
      expect(stepToDimension('direction')).toBe('direction');
    });

    it('returns mood for mood step', () => {
      expect(stepToDimension('mood')).toBe('mood');
    });

    it('returns framing for framing step', () => {
      expect(stepToDimension('framing')).toBe('framing');
    });

    it('returns lighting for lighting step', () => {
      expect(stepToDimension('lighting')).toBe('lighting');
    });

    it('returns camera_motion for camera_motion step', () => {
      expect(stepToDimension('camera_motion')).toBe('camera_motion');
    });
  });
});

describe('dimensionToStep', () => {
  describe('core behavior', () => {
    it('returns the same value (identity function)', () => {
      expect(dimensionToStep('direction')).toBe('direction');
      expect(dimensionToStep('mood')).toBe('mood');
      expect(dimensionToStep('framing')).toBe('framing');
      expect(dimensionToStep('lighting')).toBe('lighting');
      expect(dimensionToStep('camera_motion')).toBe('camera_motion');
    });
  });
});

describe('isDimensionStep', () => {
  describe('core behavior', () => {
    it('returns true for dimension steps', () => {
      expect(isDimensionStep('direction')).toBe(true);
      expect(isDimensionStep('mood')).toBe(true);
      expect(isDimensionStep('framing')).toBe(true);
      expect(isDimensionStep('lighting')).toBe(true);
      expect(isDimensionStep('camera_motion')).toBe(true);
    });

    it('returns false for non-dimension steps', () => {
      expect(isDimensionStep('intent')).toBe(false);
      expect(isDimensionStep('starting_point')).toBe(false);
      expect(isDimensionStep('final_frame')).toBe(false);
      expect(isDimensionStep('subject_motion')).toBe(false);
      expect(isDimensionStep('preview')).toBe(false);
      expect(isDimensionStep('complete')).toBe(false);
    });
  });
});

describe('getRequiredLockedDimensions', () => {
  describe('edge cases', () => {
    it('returns empty array for intent step', () => {
      expect(getRequiredLockedDimensions('intent')).toEqual([]);
    });

    it('returns empty array for starting_point step', () => {
      expect(getRequiredLockedDimensions('starting_point')).toEqual([]);
    });

    it('returns empty array for direction step', () => {
      expect(getRequiredLockedDimensions('direction')).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('returns direction for mood step', () => {
      expect(getRequiredLockedDimensions('mood')).toEqual(['direction']);
    });

    it('returns direction and mood for framing step', () => {
      expect(getRequiredLockedDimensions('framing')).toEqual(['direction', 'mood']);
    });

    it('returns direction, mood, and framing for lighting step', () => {
      expect(getRequiredLockedDimensions('lighting')).toEqual([
        'direction',
        'mood',
        'framing',
      ]);
    });

    it('returns all dimensions except camera_motion for final_frame step', () => {
      expect(getRequiredLockedDimensions('final_frame')).toEqual([
        'direction',
        'mood',
        'framing',
        'lighting',
      ]);
    });

    it('returns all dimensions for camera_motion step', () => {
      expect(getRequiredLockedDimensions('camera_motion')).toEqual([
        'direction',
        'mood',
        'framing',
        'lighting',
      ]);
    });

    it('returns all dimensions for complete step', () => {
      expect(getRequiredLockedDimensions('complete')).toEqual([
        'direction',
        'mood',
        'framing',
        'lighting',
        'camera_motion',
      ]);
    });
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('core behavior', () => {
    it('resolves after specified time', async () => {
      const promise = sleep(100);

      vi.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
    });

    it('does not resolve before specified time', async () => {
      let resolved = false;
      sleep(100).then(() => {
        resolved = true;
      });

      vi.advanceTimersByTime(50);
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(50);
      await Promise.resolve(); // Flush promises
      expect(resolved).toBe(true);
    });

    it('handles zero milliseconds', async () => {
      const promise = sleep(0);

      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toBeUndefined();
    });
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('throws after max retries exceeded', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const promise = withRetry(operation, 2, 100);

      // Attach catch handler early to suppress unhandled rejection warning
      let caughtError: Error | undefined;
      promise.catch((e: Error) => {
        caughtError = e;
      });

      await vi.runAllTimersAsync();
      await Promise.resolve(); // Flush microtasks

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Always fails');
      expect(operation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('throws the last error after all retries fail', async () => {
      let callCount = 0;
      const operation = vi.fn().mockImplementation(() => {
        callCount++;
        throw new Error(`Error ${callCount}`);
      });

      const promise = withRetry(operation, 2, 100);

      // Attach catch handler early to suppress unhandled rejection warning
      let caughtError: Error | undefined;
      promise.catch((e: Error) => {
        caughtError = e;
      });

      await vi.runAllTimersAsync();
      await Promise.resolve(); // Flush microtasks

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Error 3');
    });
  });

  describe('edge cases', () => {
    it('succeeds on first retry', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, 2, 100);

      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('succeeds on last retry', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockRejectedValueOnce(new Error('Second fail'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, 2, 100);

      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('uses exponential backoff', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = withRetry(operation, 2, 1000);

      // Don't await, just let it run
      promise.catch(() => {}); // Suppress unhandled rejection

      // First call happens immediately
      expect(operation).toHaveBeenCalledTimes(1);

      // After 1000ms (baseDelay * 2^0), second call should happen
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // After 2000ms more (baseDelay * 2^1), third call should happen
      await vi.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('respects custom maxRetries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = withRetry(operation, 0, 100);

      // Attach catch handler early to suppress unhandled rejection warning
      let caughtError: Error | undefined;
      promise.catch((e: Error) => {
        caughtError = e;
      });

      await vi.runAllTimersAsync();
      await Promise.resolve(); // Flush microtasks

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Fail');
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('core behavior', () => {
    it('returns result on immediate success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation, 2, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('uses default maxRetries of 2', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const promise = withRetry(operation);

      // Attach catch handler early to suppress unhandled rejection warning
      let caughtError: Error | undefined;
      promise.catch((e: Error) => {
        caughtError = e;
      });

      await vi.runAllTimersAsync();
      await Promise.resolve(); // Flush microtasks

      expect(caughtError).toBeInstanceOf(Error);
      expect(operation).toHaveBeenCalledTimes(3); // 1 + 2 default retries
    });

    it('uses default baseDelay of 1000ms', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation);

      // First call immediate
      expect(operation).toHaveBeenCalledTimes(1);

      // Need to wait 1000ms for retry
      await vi.advanceTimersByTimeAsync(999);
      expect(operation).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(operation).toHaveBeenCalledTimes(2);

      await expect(promise).resolves.toBe('success');
    });
  });
});
