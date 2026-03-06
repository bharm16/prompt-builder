import { describe, expect, it, vi } from 'vitest';
import { FallbackStrategyService } from '../FallbackStrategyService';
import type { ConstraintConfig, ConstraintDetails } from '@services/video-prompt-analysis/types';

describe('FallbackStrategyService regression', () => {
  const service = new FallbackStrategyService();

  const makeConstraints = (mode: string): ConstraintConfig => ({
    mode,
    minWords: 2,
    maxWords: 8,
    maxSentences: 1,
    slotDescriptor: 'test',
  });

  it('blocks generic fallback escalation for high-confidence camera spans', () => {
    const getConstraintsFn = vi.fn(() => makeConstraints('micro'));
    const details: ConstraintDetails = {
      highlightedCategory: 'camera.movement',
      highlightedCategoryConfidence: 0.9,
    };

    const result = service.getVideoFallbackConstraints(
      makeConstraints('camera'),
      details,
      new Set(['camera']),
      getConstraintsFn
    );

    expect(result).toBeNull();
    expect(getConstraintsFn).not.toHaveBeenCalled();
  });

  it('blocks generic fallback escalation for high-confidence shot spans', () => {
    const getConstraintsFn = vi.fn(() => makeConstraints('phrase'));
    const details: ConstraintDetails = {
      highlightedCategory: 'shot.type',
      highlightedCategoryConfidence: 0.95,
    };

    const result = service.getVideoFallbackConstraints(
      makeConstraints('micro'),
      details,
      new Set(['micro']),
      getConstraintsFn
    );

    expect(result).toBeNull();
    expect(getConstraintsFn).not.toHaveBeenCalled();
  });

  it('blocks generic fallback escalation for high-confidence style spans', () => {
    const getConstraintsFn = vi.fn(() => makeConstraints('phrase'));
    const details: ConstraintDetails = {
      highlightedCategory: 'style.aesthetic',
      highlightedCategoryConfidence: 0.82,
    };

    const result = service.getVideoFallbackConstraints(
      makeConstraints('adjective'),
      details,
      new Set(['adjective']),
      getConstraintsFn
    );

    expect(result).toBeNull();
    expect(getConstraintsFn).not.toHaveBeenCalled();
  });

  it('keeps fallback behavior for non-strict categories', () => {
    const getConstraintsFn = vi.fn(() => makeConstraints('phrase'));
    const details: ConstraintDetails = {
      highlightedCategory: 'lighting.quality',
      highlightedCategoryConfidence: 0.9,
    };

    const result = service.getVideoFallbackConstraints(
      makeConstraints('adjective'),
      details,
      new Set(['adjective']),
      getConstraintsFn
    );

    expect(result?.mode).toBe('phrase');
    expect(getConstraintsFn).toHaveBeenCalledWith(details, { forceMode: 'phrase' });
  });
});
