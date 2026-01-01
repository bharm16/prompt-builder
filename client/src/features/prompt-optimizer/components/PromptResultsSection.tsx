import React from 'react';
import { PromptCanvas } from '../PromptCanvas';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptResultsSectionProps } from '../types';

/**
 * PromptResultsSection - Results/Canvas Section
 *
 * Handles the prompt canvas and results display
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptResultsSection = ({
  onDisplayedPromptChange,
  onReoptimize,
  onFetchSuggestions,
  onSuggestionClick,
  onHighlightsPersist,
  onUndo,
  onRedo,
  stablePromptContext = null,
}: PromptResultsSectionProps): React.ReactElement | null => {
  const {
    showResults,
    currentPromptUuid,
    promptOptimizer,
    currentMode,
    suggestionsData,
    initialHighlights,
    initialHighlightsVersion,
    canUndo,
    canRedo,
    handleCreateNew,
  } = usePromptState();

  if (!showResults) {
    return null;
  }

  return (
    <>
      {/* Refinement indicator banner - floats absolutely */}
      {promptOptimizer.isRefining && (
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4">
          <div className="mx-auto max-w-5xl">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3 shadow-lg">
            <div className="flex-shrink-0">
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Draft ready! Refining in background...
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                You can edit the draft now. The refined version will appear when ready.
              </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <PromptCanvas
        inputPrompt={promptOptimizer.inputPrompt}
        onInputPromptChange={promptOptimizer.setInputPrompt}
        onReoptimize={onReoptimize}
        displayedPrompt={promptOptimizer.displayedPrompt}
        optimizedPrompt={promptOptimizer.optimizedPrompt}
        previewPrompt={promptOptimizer.previewPrompt}
        previewAspectRatio={promptOptimizer.previewAspectRatio}
        qualityScore={promptOptimizer.qualityScore}
        selectedMode={currentMode.id}
        currentMode={currentMode}
        promptUuid={currentPromptUuid}
        promptContext={stablePromptContext}
        onDisplayedPromptChange={onDisplayedPromptChange}
        suggestionsData={suggestionsData}
        onFetchSuggestions={onFetchSuggestions}
        onSuggestionClick={onSuggestionClick}
        onCreateNew={handleCreateNew}
        initialHighlights={initialHighlights}
        initialHighlightsVersion={initialHighlightsVersion}
        onHighlightsPersist={onHighlightsPersist}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        // Two-stage indicators
        isDraftReady={promptOptimizer.isDraftReady}
        isRefining={promptOptimizer.isRefining}
        isProcessing={promptOptimizer.isProcessing}
        // Span labeling for fast highlights (NEW!)
        draftSpans={promptOptimizer.draftSpans}
        refinedSpans={promptOptimizer.refinedSpans}
      />
    </>
  );
};
