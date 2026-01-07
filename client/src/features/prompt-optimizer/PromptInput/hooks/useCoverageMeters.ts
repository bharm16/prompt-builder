import { useMemo } from 'react';
import { COVERAGE_CATEGORIES, type CoverageCategory } from '../constants';
import { computeCoverageScore } from '../utils/coverage';

export type CoverageMeter = CoverageCategory & { fill: number };

export const useCoverageMeters = (inputPrompt: string): CoverageMeter[] =>
  useMemo(
    () =>
      COVERAGE_CATEGORIES.map((category) => ({
        ...category,
        fill: computeCoverageScore(inputPrompt, category.words),
      })),
    [inputPrompt]
  );
