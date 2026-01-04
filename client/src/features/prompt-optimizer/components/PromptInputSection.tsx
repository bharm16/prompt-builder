import React from 'react';
import { PromptInput } from '../PromptInput';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptInputSectionProps } from '../types';

/**
 * PromptInputSection - Input/Hero Section
 *
 * Handles the prompt input and loading skeleton
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptInputSection = ({ aiNames, onOptimize, onShowBrainstorm }: PromptInputSectionProps): React.ReactElement => {
  const {
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    currentAIIndex,
    promptOptimizer,
  } = usePromptState();

  if (promptOptimizer.isProcessing) {
    return <LoadingSkeleton />;
  }

  return (
    <PromptInput
      inputPrompt={promptOptimizer.inputPrompt}
      onInputChange={promptOptimizer.setInputPrompt}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      onOptimize={onOptimize}
      generationParams={generationParams}
      onGenerationParamsChange={setGenerationParams}
      {...(onShowBrainstorm ? { onShowBrainstorm } : {})}
      isProcessing={promptOptimizer.isProcessing}
      {...(aiNames ? { aiNames } : {})}
      currentAIIndex={currentAIIndex}
    />
  );
};

/**
 * Loading Skeleton Component
 * Shows mode-specific skeleton while processing
 */
const LoadingSkeleton = (): React.ReactElement => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative overflow-hidden p-8 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
        style={{ animationDuration: '1.5s' }}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />

        <div className="relative space-y-6">
          <VideoModeSkeleton />
        </div>
      </div>
    </div>
  );
};

// Skeleton variants for each mode
const VideoModeSkeleton = (): React.ReactElement => (
  <>
    <div className="space-y-2">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="h-3 bg-neutral-200/70 rounded-md" style={{ width: `${85 + (i % 3) * 5}%` }} />
      ))}
    </div>
    <div className="space-y-3 pt-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-40" />
      <div className="space-y-2 ml-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{ width: `${44 + i * 4}%` }} />
        ))}
      </div>
    </div>
    <div className="space-y-3 pt-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-56" />
      <div className="space-y-2 ml-2">
        {[...Array(2)].map((_, i) => (
          <React.Fragment key={i}>
            <div className="h-3 bg-neutral-200/60 rounded-md w-44" />
            <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
          </React.Fragment>
        ))}
      </div>
    </div>
  </>
);
