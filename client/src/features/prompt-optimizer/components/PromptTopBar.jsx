/**
 * PromptTopBar - Top Action Buttons
 *
 * Handles the fixed top-left action buttons (New, History toggle)
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */

import React from 'react';
import { PanelLeft } from 'lucide-react';
import { usePromptState } from '../context/PromptStateContext';

export const PromptTopBar = () => {
  const {
    showHistory,
    setShowHistory,
    showBrainstorm,
  } = usePromptState();

  // Hide when brainstorm wizard is open or when sidebar is visible
  if (showBrainstorm || showHistory) {
    return null;
  }

  return (
    <div className="fixed left-6 top-6 z-fixed">
      <button
        onClick={() => setShowHistory(true)}
        className="btn-icon-secondary shadow-lg hover-scale ripple"
        aria-label="Show history sidebar"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
    </div>
  );
};
