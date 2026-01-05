import React from 'react';
import { HistorySidebar } from '@features/history/HistorySidebar';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptSidebarProps } from '../types';

type PromptRowStage = 'draft' | 'optimized' | 'generated' | 'error';

function resolveActiveStage(params: {
  inputPrompt: string;
  displayedPrompt: string;
  isProcessing: boolean;
  isRefining: boolean;
  hasHighlights: boolean;
}): { stage: PromptRowStage; statusLabel: string } {
  const hasInput = params.inputPrompt.trim().length > 0;
  const hasOutput = params.displayedPrompt.trim().length > 0;

  if (params.isRefining) return { stage: 'optimized', statusLabel: 'Refining' };
  if (params.isProcessing) return { stage: 'optimized', statusLabel: 'Optimizing' };
  if (!hasInput && !hasOutput) return { stage: 'draft', statusLabel: 'Draft' };
  if (hasOutput && params.hasHighlights) return { stage: 'generated', statusLabel: 'Generated' };
  if (hasOutput) return { stage: 'optimized', statusLabel: 'Optimized' };
  if (hasInput) return { stage: 'draft', statusLabel: 'Draft' };
  return { stage: 'error', statusLabel: 'Incomplete' };
}

/**
 * PromptSidebar - History Sidebar Wrapper
 *
 * Wraps the HistorySidebar with context-aware props
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptSidebar = ({ user }: PromptSidebarProps): React.ReactElement | null => {
  const {
    showHistory,
    setShowHistory,
    showBrainstorm,
    promptHistory,
    loadFromHistory,
    handleCreateNew,
    currentPromptUuid,
    currentPromptDocId,
    selectedModel,
    generationParams,
    promptOptimizer,
    initialHighlights,
  } = usePromptState();

  // Hide when brainstorm modal is open
  if (showBrainstorm) {
    return null;
  }

  const activeTitle =
    promptOptimizer.inputPrompt.trim() ||
    promptOptimizer.displayedPrompt.trim() ||
    'Untitled prompt';

  const { stage: activeStage, statusLabel: activeStatusLabel } = resolveActiveStage({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    hasHighlights: Boolean(initialHighlights),
  });

  const activeModelLabel = selectedModel?.trim() ? selectedModel.trim() : 'Default';
  const activeDurationS =
    typeof (generationParams as Record<string, unknown>)?.duration_s === 'number'
      ? ((generationParams as Record<string, unknown>).duration_s as number)
      : null;

  return (
    <HistorySidebar
      showHistory={showHistory}
      setShowHistory={setShowHistory}
      user={user}
      history={promptHistory.history}
      filteredHistory={promptHistory.filteredHistory}
      isLoadingHistory={promptHistory.isLoadingHistory}
      searchQuery={promptHistory.searchQuery}
      onSearchChange={promptHistory.setSearchQuery}
      onLoadFromHistory={loadFromHistory}
      onCreateNew={handleCreateNew}
      onDelete={promptHistory.deleteFromHistory}
      currentPromptUuid={currentPromptUuid}
      currentPromptDocId={currentPromptDocId}
      activeTitle={activeTitle}
      activeStage={activeStage}
      activeStatusLabel={activeStatusLabel}
      activeModelLabel={activeModelLabel}
      activeDurationS={activeDurationS}
    />
  );
};
