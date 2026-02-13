import React, { type ReactNode } from 'react';
import { SidebarSessionsContextProvider } from '@/components/ToolSidebar/context';
import { useGenerationControlsStoreActions } from '@/features/prompt-optimizer/context/GenerationControlsStore';
import {
  usePromptActions,
  usePromptConfig,
  usePromptHighlights,
  usePromptServices,
  usePromptSession,
} from '@/features/prompt-optimizer/context/PromptStateContext';
import { usePromptHistoryActions } from '@/features/prompt-optimizer/PromptOptimizerContainer/hooks';
import { resolveActiveModelLabel, resolveActiveStatusLabel } from '@/features/prompt-optimizer/utils/activeStatusLabel';

export function SidebarSessionsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { promptHistory, promptOptimizer } = usePromptServices();
  const { selectedModel } = usePromptConfig();
  const { initialHighlights } = usePromptHighlights();
  const { currentPromptUuid, currentPromptDocId } = usePromptSession();
  const { handleCreateNew, loadFromHistory } = usePromptActions();
  const { setKeyframes } = useGenerationControlsStoreActions();

  const {
    handleLoadFromHistory,
    handleCreateNewWithKeyframes,
    handleDuplicate,
    handleRename,
  } = usePromptHistoryActions({
    promptHistory,
    setKeyframes,
    loadFromHistory,
    handleCreateNew,
  });

  const activeStatusLabel = resolveActiveStatusLabel({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    hasHighlights: Boolean(initialHighlights),
  });
  const activeModelLabel = resolveActiveModelLabel(selectedModel);

  const value = {
    history: promptHistory.history,
    filteredHistory: promptHistory.filteredHistory,
    isLoadingHistory: promptHistory.isLoadingHistory,
    searchQuery: promptHistory.searchQuery,
    onSearchChange: promptHistory.setSearchQuery,
    onLoadFromHistory: handleLoadFromHistory,
    onCreateNew: handleCreateNewWithKeyframes,
    onDelete: promptHistory.deleteFromHistory,
    onDuplicate: handleDuplicate,
    onRename: handleRename,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
  };

  return <SidebarSessionsContextProvider value={value}>{children}</SidebarSessionsContextProvider>;
}
