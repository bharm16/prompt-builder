import React from 'react';
import { HistorySidebar } from '../../history/HistorySidebar';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptSidebarProps } from '../types';

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
    modes,
    promptHistory,
    loadFromHistory,
    handleCreateNew,
  } = usePromptState();

  // Hide when brainstorm modal is open
  if (showBrainstorm) {
    return null;
  }

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
      modes={modes}
    />
  );
};

