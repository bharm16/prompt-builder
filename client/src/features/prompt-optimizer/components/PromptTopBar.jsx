/**
 * PromptTopBar - Top Action Buttons
 *
 * Handles the fixed top-left action buttons (New, History toggle)
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */

import React from 'react';
import { Plus, PanelLeft } from 'lucide-react';
import { usePromptState } from '../context/PromptStateContext';

export const PromptTopBar = () => {
  const {
    showHistory,
    setShowHistory,
    showBrainstorm,
    handleCreateNew,
  } = usePromptState();

  // Hide when brainstorm wizard is open
  if (showBrainstorm) {
    return null;
  }

  return (
    <div className="fixed left-6 top-6 z-fixed flex flex-col gap-2">
      <button
        onClick={handleCreateNew}
        className="btn-icon-secondary shadow-lg hover-scale ripple"
        aria-label="Create new prompt"
      >
        <Plus className="h-5 w-5" />
      </button>
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="btn-icon-secondary shadow-lg hover-scale ripple"
        aria-label={showHistory ? 'Hide history sidebar' : 'Show history sidebar'}
        aria-expanded={showHistory}
      >
        <PanelLeft className="h-5 w-5" />
      </button>
    </div>
  );
};
