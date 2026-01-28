import React from 'react';
import type { ModelScore } from '../../types';
import { ScoreBar } from './ScoreBar';
import { RecommendationReasons } from './RecommendationReasons';
import { cn } from '@/utils/cn';

interface ModelScoreCardProps {
  score: ModelScore;
  label: string;
  variant?: 'primary' | 'secondary';
  actionLabel?: string;
  onSelect?: (modelId: string) => void;
  showReasons?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: 'border-[#3A3A40] bg-[#23242A]',
  secondary: 'border-[#29292D] bg-[#1E1F25]',
};

export function ModelScoreCard({
  score,
  label,
  variant = 'secondary',
  actionLabel = 'Use',
  onSelect,
  showReasons = true,
}: ModelScoreCardProps): React.ReactElement {
  return (
    <div className={cn('rounded-lg border p-3', variantStyles[variant])}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-white">{label}</div>
          <div className="text-[11px] text-[#A1AFC5]">{score.overallScore}% match</div>
        </div>
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(score.modelId)}
            className={cn(
              'h-7 px-2 rounded-md text-xs font-semibold',
              variant === 'primary'
                ? 'bg-white text-[#1A1A1A] hover:opacity-90'
                : 'border border-[#29292D] text-[#A1AFC5] hover:bg-[#1B1E23]'
            )}
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="mt-2">
        <ScoreBar value={score.overallScore} />
      </div>

      {showReasons && (
        <RecommendationReasons score={score} showWarnings={variant === 'secondary'} />
      )}
    </div>
  );
}
