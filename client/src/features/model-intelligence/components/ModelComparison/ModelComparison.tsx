import React from 'react';
import type { ModelScore } from '../../types';
import { getModelLabel } from '../../utils/modelLabels';
import { ModelScoreCard } from '../ModelRecommendation/ModelScoreCard';
import { ComparisonPreview } from './ComparisonPreview';
import { cn } from '@/utils/cn';

interface ModelComparisonProps {
  left: ModelScore;
  right: ModelScore;
  onSelectModel?: (modelId: string) => void;
  onClose?: () => void;
  leftPreviewUrl?: string;
  rightPreviewUrl?: string;
  className?: string;
}

export function ModelComparison({
  left,
  right,
  onSelectModel,
  onClose,
  leftPreviewUrl,
  rightPreviewUrl,
  className,
}: ModelComparisonProps): React.ReactElement {
  const leftLabel = getModelLabel(left.modelId);
  const rightLabel = getModelLabel(right.modelId);

  return (
    <div className={cn('rounded-lg border border-[#2A2B31] bg-[#17191E] p-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#A1AFC5]">Compare Models</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[#7F8CA3] hover:text-white"
          >
            Close
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <ComparisonPreview label={leftLabel} imageUrl={leftPreviewUrl} />
          <ModelScoreCard
            score={left}
            label={leftLabel}
            variant="secondary"
            actionLabel="Use"
            onSelect={onSelectModel}
          />
        </div>
        <div className="space-y-2">
          <ComparisonPreview label={rightLabel} imageUrl={rightPreviewUrl} />
          <ModelScoreCard
            score={right}
            label={rightLabel}
            variant="secondary"
            actionLabel="Use"
            onSelect={onSelectModel}
          />
        </div>
      </div>
    </div>
  );
}
