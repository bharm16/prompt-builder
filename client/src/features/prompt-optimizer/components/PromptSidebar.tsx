import React from 'react';
import { HistorySidebar } from '@features/history/HistorySidebar';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptSidebarProps } from '../types';
import type { PromptHistoryEntry } from '@hooks/types';

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

  const activeEntry = promptHistory.history.find(
    (entry) =>
      (currentPromptUuid && entry.uuid === currentPromptUuid) ||
      (currentPromptDocId && entry.id === currentPromptDocId)
  );
  const activeTitle =
    activeEntry?.title?.trim() ||
    promptOptimizer.inputPrompt.trim() ||
    promptOptimizer.displayedPrompt.trim() ||
    'Untitled prompt';

  const { statusLabel: activeStatusLabel } = resolveActiveStage({
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

  const handleDuplicate = React.useCallback(
    async (entry: PromptHistoryEntry): Promise<void> => {
      const mode =
        typeof entry.mode === 'string' && entry.mode.trim()
          ? entry.mode.trim()
          : 'video';
      const result = await promptHistory.saveToHistory(
        entry.input,
        entry.output,
        entry.score ?? null,
        mode,
        entry.targetModel ?? null,
        (entry.generationParams as Record<string, unknown>) ?? null,
        entry.brainstormContext ?? null,
        entry.highlightCache ?? null,
        null,
        entry.title ?? null
      );

      if (result?.uuid) {
        loadFromHistory({
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          title: entry.title ?? null,
          input: entry.input,
          output: entry.output,
          score: entry.score ?? null,
          mode,
          targetModel: entry.targetModel ?? null,
          generationParams: entry.generationParams ?? null,
          brainstormContext: entry.brainstormContext ?? null,
          highlightCache: entry.highlightCache ?? null,
          versions: Array.isArray(entry.versions) ? entry.versions : [],
        });
      }
    },
    [promptHistory, loadFromHistory]
  );

  const handleRename = React.useCallback(
    (entry: PromptHistoryEntry, title: string): void => {
      if (!entry.uuid) return;
      promptHistory.updateEntryPersisted(entry.uuid, entry.id ?? null, { title });
    },
    [promptHistory]
  );

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
      onDuplicate={handleDuplicate}
      onRename={handleRename}
      currentPromptUuid={currentPromptUuid}
      currentPromptDocId={currentPromptDocId}
      activeTitle={activeTitle}
      activeStatusLabel={activeStatusLabel}
      activeModelLabel={activeModelLabel}
      activeDurationS={activeDurationS}
    />
  );
};
