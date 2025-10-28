/**
 * PromptResultsSection - Results/Canvas Section
 *
 * Handles the prompt canvas and results display
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */

import React from 'react';
import { PromptCanvas } from '../PromptCanvas';
import { usePromptState } from '../context/PromptStateContext';
import { createHighlightSignature } from '../hooks/useSpanLabeling';

export const PromptResultsSection = ({
  onDisplayedPromptChange,
  onFetchSuggestions,
  onHighlightsPersist,
  onUndo,
  onRedo,
  stablePromptContext,
}) => {
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

  if (!showResults || promptOptimizer.isProcessing) {
    return null;
  }

  return (
    <PromptCanvas
      key={
        currentPromptUuid
          ? `prompt-${currentPromptUuid}`
          : `prompt-${createHighlightSignature(promptOptimizer.displayedPrompt ?? '')}`
      }
      inputPrompt={promptOptimizer.inputPrompt}
      displayedPrompt={promptOptimizer.displayedPrompt}
      optimizedPrompt={promptOptimizer.optimizedPrompt}
      qualityScore={promptOptimizer.qualityScore}
      selectedMode={currentMode.id}
      currentMode={currentMode}
      promptUuid={currentPromptUuid}
      promptContext={stablePromptContext}
      onDisplayedPromptChange={onDisplayedPromptChange}
      suggestionsData={suggestionsData}
      onFetchSuggestions={onFetchSuggestions}
      onCreateNew={handleCreateNew}
      initialHighlights={initialHighlights}
      initialHighlightsVersion={initialHighlightsVersion}
      onHighlightsPersist={onHighlightsPersist}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
    />
  );
};
