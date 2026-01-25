/**
 * usePromptHistory - Orchestrator Hook
 *
 * Coordinates prompt history workflow by delegating to:
 * - useHistoryState: State management
 * - useHistoryPersistence: Persistence + promotions
 *
 * Single Responsibility: Orchestrate the prompt history workflow
 */

import { useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { useHistoryState, useHistoryPersistence } from './hooks';
import type { User, Toast } from './types';

export const usePromptHistory = (user: User | null) => {
  const toast = useToast() as Toast;
  const {
    state,
    setHistory,
    addEntry,
    updateEntry,
    removeEntry,
    clearEntries,
    setIsLoadingHistory,
    searchQuery,
    setSearchQuery,
    filteredHistory,
  } = useHistoryState();

  const {
    loadHistoryFromFirestore,
    loadHistoryFromLocalStorage,
    saveToHistory,
    createDraft,
    updateEntryLocal,
    updateEntryPersisted,
    updateEntryHighlight,
    updateEntryOutput,
    updateEntryVersions,
    clearHistory,
    deleteFromHistory,
  } = useHistoryPersistence({
    user,
    history: state.history,
    setHistory,
    addEntry,
    updateEntry,
    removeEntry,
    clearEntries,
    setIsLoadingHistory,
    toast,
  });

  // Load history on mount and when user changes
  // Bug 4 fix: guard against stale async responses when user changes rapidly
  useEffect(() => {
    let isActive = true;

    if (user) {
      const timerId = window.setTimeout(() => {
        if (isActive) {
          void loadHistoryFromFirestore(user.uid);
        }
      }, 500);
      return () => {
        isActive = false;
        window.clearTimeout(timerId);
      };
    } else {
      void loadHistoryFromLocalStorage();
      return () => {
        isActive = false;
      };
    }
  }, [user, loadHistoryFromFirestore, loadHistoryFromLocalStorage]);

  return {
    history: state.history,
    filteredHistory,
    isLoadingHistory: state.isLoadingHistory,
    searchQuery,
    setSearchQuery,
    saveToHistory,
    createDraft,
    updateEntryLocal,
    updateEntryPersisted,
    clearHistory,
    deleteFromHistory,
    loadHistoryFromFirestore,
    updateEntryHighlight,
    updateEntryOutput,
    updateEntryVersions,
  };
};
