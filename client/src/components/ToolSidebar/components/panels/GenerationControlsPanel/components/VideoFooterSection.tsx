import React from 'react';
import { ModelRecommendation } from '@/features/model-intelligence';

interface VideoFooterSectionProps {
  prompt: string;
  duration: number;
  recommendationMode: 'i2v' | 't2v';
  recommendation: unknown;
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
  const shouldShowRecommendation = prompt.trim().length >= 10;

  return (
    <>
      {shouldShowRecommendation && (
        <div className="px-4 pb-2">
          <ModelRecommendation
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
