import React from 'react';
import { PanelLeft } from 'lucide-react';
import { usePromptState } from '../context/PromptStateContext';

/**
 * PromptTopBar - Top Action Buttons
 *
 * Handles the fixed top-left action buttons (New, History toggle)
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptTopBar = (): React.ReactElement | null => {
  const {
    showHistory,
    setShowHistory,
    showBrainstorm,
  } = usePromptState();

  // Hide when brainstorm modal is open
  if (showBrainstorm) {
    return null;
  }

  // Sidebar is always visible now (collapsed or expanded), so we don't need the top bar toggle
  return null;
};

