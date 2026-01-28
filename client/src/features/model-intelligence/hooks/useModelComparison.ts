import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModelScore } from '../types';

interface UseModelComparisonOptions {
  recommendations?: ModelScore[];
  comparisonModels?: [string, string];
}

interface ComparisonPair {
  left: ModelScore;
  right: ModelScore;
}

interface UseModelComparisonResult {
  isOpen: boolean;
  comparison: ComparisonPair | null;
  openComparison: (models?: [string, string]) => void;
  closeComparison: () => void;
}

const resolvePair = (
  recommendations: ModelScore[] | undefined,
  models: [string, string] | undefined
): ComparisonPair | null => {
  if (!recommendations || recommendations.length < 2) return null;
  if (!models) return null;

  const left = recommendations.find((score) => score.modelId === models[0]);
  const right = recommendations.find((score) => score.modelId === models[1]);

  if (!left || !right) return null;
  return { left, right };
};

export const useModelComparison = ({
  recommendations,
  comparisonModels,
}: UseModelComparisonOptions = {}): UseModelComparisonResult => {
  const [activeModels, setActiveModels] = useState<[string, string] | null>(
    comparisonModels ?? null
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!comparisonModels) return;
    if (isOpen) return;
    setActiveModels(comparisonModels);
  }, [comparisonModels, isOpen]);

  const comparison = useMemo(
    () => resolvePair(recommendations, activeModels ?? undefined),
    [activeModels, recommendations]
  );

  useEffect(() => {
    if (isOpen && !comparison) {
      setIsOpen(false);
    }
  }, [comparison, isOpen]);

  const openComparison = useCallback(
    (models?: [string, string]) => {
      const resolved = models ?? comparisonModels;
      if (resolved) {
        setActiveModels(resolved);
        setIsOpen(true);
      }
    },
    [comparisonModels]
  );

  const closeComparison = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, comparison, openComparison, closeComparison };
};
