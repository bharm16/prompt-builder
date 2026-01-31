import React from 'react';
import { ModelRecommendation as ModelRecommendationComponent } from '@/features/model-intelligence';
import type { ModelRecommendation as ModelRecommendationType } from '@/features/model-intelligence/types';
import { MIN_PROMPT_LENGTH_FOR_RECOMMENDATION } from '@/features/model-intelligence/constants';

interface VideoFooterSectionProps {
  prompt: string;
  duration: number;
  recommendationMode: 'i2v' | 't2v';
  recommendation?: ModelRecommendationType | null;
  isLoading: boolean;
  error: string | null;
  onSelectModel: (model: string) => void;
  footer: React.ReactNode;
}

export function VideoFooterSection({
  prompt,
  duration,
  recommendationMode,
  recommendation,
  isLoading,
  error,
  onSelectModel,
  footer,
}: VideoFooterSectionProps): React.ReactElement {
  const shouldShowRecommendation = prompt.trim().length >= MIN_PROMPT_LENGTH_FOR_RECOMMENDATION;

  return (
    <>
      {shouldShowRecommendation && (
        <div className="px-4 pb-2">
          <ModelRecommendationComponent
            prompt={prompt}
            mode={recommendationMode}
            durationSeconds={duration}
            onSelectModel={onSelectModel}
            recommendation={recommendation}
            isLoading={isLoading}
            error={error}
          />
        </div>
      )}

      {footer}
    </>
  );
}
