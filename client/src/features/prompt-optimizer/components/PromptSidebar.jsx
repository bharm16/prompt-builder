/**
 * PromptSidebar - History Sidebar Wrapper
 *
 * Wraps the HistorySidebar with context-aware props
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */

import React from 'react';
import { HistorySidebar } from '../../history/HistorySidebar';
import { usePromptState } from '../context/PromptStateContext';

export const PromptSidebar = ({ user }) => {
  const {
    showHistory,
    showBrainstorm,
    modes,
    promptHistory,
    loadFromHistory,
    handleCreateNew,
  } = usePromptState();

  // Hide when brainstorm wizard is open
  if (showBrainstorm) {
    return null;
  }

  return (
    <HistorySidebar
      showHistory={showHistory}
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
