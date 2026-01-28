import React, { useMemo } from 'react';
import type { ModelScore } from '../../types';

interface RecommendationReasonsProps {
  score: ModelScore;
  maxItems?: number;
  showWarnings?: boolean;
  showWeaknesses?: boolean;
}

const buildFallbackReasons = (score: ModelScore, maxItems: number): string[] => {
  const sorted = [...score.factorScores].sort((a, b) => b.contribution - a.contribution);
  return sorted.slice(0, maxItems).map((factor) => factor.label);
};

export function RecommendationReasons({
  score,
  maxItems = 2,
  showWarnings = false,
  showWeaknesses = false,
}: RecommendationReasonsProps): React.ReactElement | null {
  const reasons = useMemo(() => {
    if (score.strengths.length) {
      return score.strengths.slice(0, maxItems);
    }
    const fallback = buildFallbackReasons(score, maxItems);
    return fallback.length ? fallback : [];
  }, [maxItems, score]);

  if (!reasons.length && !showWarnings && !showWeaknesses) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 text-[11px] text-[#7F8CA3]">
      {reasons.map((reason) => (
        <div key={reason}>• {reason}</div>
      ))}
      {showWeaknesses &&
        score.weaknesses.slice(0, 1).map((weakness) => (
          <div key={weakness} className="text-[#C08F4A]">
            • {weakness}
          </div>
        ))}
      {showWarnings &&
        score.warnings.slice(0, 1).map((warning) => (
          <div key={warning} className="text-[#C06A6A]">
            • {warning}
          </div>
        ))}
    </div>
  );
}
