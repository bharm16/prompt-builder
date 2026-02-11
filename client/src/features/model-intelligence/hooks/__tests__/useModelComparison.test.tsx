import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModelComparison } from '../useModelComparison';
import type { ModelScore } from '@features/model-intelligence/types';

const recommendations: ModelScore[] = [
  {
    modelId: 'sora-2',
    overallScore: 91,
    factorScores: [],
    strengths: [],
    weaknesses: [],
    warnings: [],
  },
  {
    modelId: 'luma-ray3',
    overallScore: 88,
    factorScores: [],
    strengths: [],
    weaknesses: [],
    warnings: [],
  },
];
const comparisonPair: [string, string] = ['sora-2', 'luma-ray3'];

describe('useModelComparison', () => {
  it('returns null comparison when models are missing', () => {
    const { result } = renderHook(() => useModelComparison({ recommendations }));
    expect(result.current.comparison).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('opens and closes comparison for valid model pair', () => {
    const { result } = renderHook(() =>
      useModelComparison({
        recommendations,
        comparisonModels: comparisonPair,
      })
    );

    act(() => {
      result.current.openComparison();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.comparison).toMatchObject({
      left: { modelId: 'sora-2' },
      right: { modelId: 'luma-ray3' },
    });

    act(() => {
      result.current.closeComparison();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('closes open comparison when the selected models are no longer resolvable', () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useModelComparison({
          recommendations: items,
          comparisonModels: comparisonPair,
        }),
      { initialProps: { items: recommendations } }
    );

    act(() => {
      result.current.openComparison();
    });
    expect(result.current.isOpen).toBe(true);

    rerender({
      items: [recommendations[0]!],
    });

    expect(result.current.comparison).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });
});
