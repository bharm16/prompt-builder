import React from 'react';
import { PromptInput } from '../PromptInput';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptInputSectionProps, LoadingSkeletonProps } from '../types';

/**
 * PromptInputSection - Input/Hero Section
 *
 * Handles the prompt input and loading skeleton
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptInputSection = ({ aiNames, onOptimize, onShowBrainstorm }: PromptInputSectionProps): React.ReactElement => {
  const {
    selectedMode,
    setSelectedMode,
    modes,
    currentAIIndex,
    promptOptimizer,
  } = usePromptState();

  if (promptOptimizer.isProcessing) {
    return <LoadingSkeleton selectedMode={selectedMode} />;
  }

  return (
    <PromptInput
      inputPrompt={promptOptimizer.inputPrompt}
      onInputChange={promptOptimizer.setInputPrompt}
      selectedMode={selectedMode}
      onModeChange={setSelectedMode}
      onOptimize={onOptimize}
      {...(onShowBrainstorm ? { onShowBrainstorm } : {})}
      isProcessing={promptOptimizer.isProcessing}
      modes={modes}
      {...(aiNames ? { aiNames } : {})}
      currentAIIndex={currentAIIndex}
    />
  );
};

/**
 * Loading Skeleton Component
 * Shows mode-specific skeleton while processing
 */
const LoadingSkeleton = ({ selectedMode }: LoadingSkeletonProps): React.ReactElement => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative overflow-hidden p-8 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
        style={{ animationDuration: '1.5s' }}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />

        <div className="relative space-y-6">
          {selectedMode === 'video' ? (
            <VideoModeSkeleton />
          ) : selectedMode === 'research' ? (
            <ResearchModeSkeleton />
          ) : selectedMode === 'socratic' ? (
            <SocraticModeSkeleton />
          ) : selectedMode === 'reasoning' ? (
            <ReasoningModeSkeleton />
          ) : (
            <StandardModeSkeleton />
          )}
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

const ResearchModeSkeleton = (): React.ReactElement => (
  <>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-60" />
      <div className="ml-2 space-y-1.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{ width: `${85 + (i % 3) * 5}%` }} />
        ))}
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-44" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
    </div>
  </>
);

const SocraticModeSkeleton = (): React.ReactElement => (
  <>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
    </div>
    {[3, 4, 5].map((count, idx) => (
      <div key={idx} className="space-y-2">
        <div className="h-4 bg-neutral-200/70 rounded-md w-60" />
        <div className="ml-2 space-y-1.5">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{ width: `${80 + i * 5}%` }} />
          ))}
        </div>
      </div>
    ))}
  </>
);

const ReasoningModeSkeleton = (): React.ReactElement => (
  <>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-40" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-56" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
      <div className="ml-2 space-y-1.5">
        <div className="h-3 bg-neutral-200/60 rounded-md w-4/5" />
        <div className="h-3 bg-neutral-200/60 rounded-md w-5/6" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-64" />
      <div className="ml-2 space-y-1.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{ width: `${82 + i * 4}%` }} />
        ))}
      </div>
    </div>
  </>
);

const StandardModeSkeleton = (): React.ReactElement => (
  <>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-32" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-36" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
      <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-neutral-200/70 rounded-md w-48" />
      <div className="ml-2 space-y-1.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{ width: `${80 + i * 4}%` }} />
        ))}
      </div>
    </div>
  </>
);
