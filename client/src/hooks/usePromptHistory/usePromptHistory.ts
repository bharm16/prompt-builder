/**
 * usePromptHistory - Orchestrator Hook
 *
 * Coordinates prompt history workflow by delegating to:
 * - useHistoryState: State management
 * - historyRepository: Repository operations
 *
 * Single Responsibility: Orchestrate the prompt history workflow
 */

import { useCallback, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { logger } from '../../services/LoggingService';
import { useHistoryState } from './hooks';
import {
  loadFromFirestore,
  loadFromLocalStorage,
  syncToLocalStorage,
  saveEntry,
  updateHighlights,
  updateOutput,
  deleteEntry,
  clearAll,
} from './api';
import type { User, PromptHistoryEntry, Toast, SaveResult } from './types';

const log = logger.child('usePromptHistory');

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

  // Load history from Firestore
  const loadHistoryFromFirestore = useCallback(
    async (userId: string) => {
      setIsLoadingHistory(true);

      try {
        const entries = await loadFromFirestore(userId);
        setHistory(entries);

        // Sync to localStorage
        if (entries.length > 0) {
          const syncResult = syncToLocalStorage(entries);
          if (syncResult.trimmed) {
            toast.warning('Storage limit reached. Keeping only recent 50 items.');
          } else if (!syncResult.success) {
            toast.error('Browser storage full. Please clear browser data.');
          }
        }
      } catch (error) {
        log.error('Error loading history', error as Error, { userId });

        // Fallback to localStorage
        try {
          const localEntries = await loadFromLocalStorage();
          setHistory(localEntries);
        } catch (localError) {
          log.error('Error loading from localStorage fallback', localError as Error);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [setHistory, setIsLoadingHistory, toast]
  );

  // Load history on mount and when user changes
  useEffect(() => {
    if (user) {
      // Clear localStorage on mount when user is signed in
      localStorage.removeItem('promptHistory');

      // Wait a bit to ensure auth tokens are ready
      setTimeout(async () => {
        await loadHistoryFromFirestore(user.uid);
      }, 500);
    } else {
      // Load from localStorage for unauthenticated users
      const loadLocal = async () => {
        try {
          const entries = await loadFromLocalStorage();
          setHistory(entries);
        } catch (error) {
          log.error('Error loading history from localStorage', error as Error);
        }
      };
      loadLocal();
    }
  }, [user, loadHistoryFromFirestore, setHistory]);

  // Save to history
  const saveToHistory = useCallback(
    async (
      input: string,
      output: string,
      score: number | null,
      selectedMode: string,
      brainstormContext: unknown = null,
      highlightCache: unknown = null
    ): Promise<SaveResult | null> => {
      log.debug('Saving to history', {
        mode: selectedMode,
        hasUser: !!user,
        inputLength: input.length,
      });

      try {
        const result = await saveEntry(user?.uid, {
          input,
          output,
          score,
          mode: selectedMode,
          brainstormContext,
          highlightCache,
        });

        const newEntry: PromptHistoryEntry = {
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          input,
          output,
          score,
          mode: selectedMode,
          brainstormContext: brainstormContext ?? null,
          highlightCache: highlightCache ?? null,
        };

        addEntry(newEntry);
        return result;
      } catch (error) {
        log.error('Error saving to history', error as Error, {
          userId: user?.uid,
          mode: selectedMode,
        });
        toast.error(user ? 'Failed to save to cloud' : 'Failed to save to history');
        return null;
      }
    },
    [user, toast, addEntry]
  );

  // Update highlight cache
  const updateEntryHighlight = useCallback(
    (uuid: string, highlightCache: unknown) => {
      // Update repository (fire and forget)
      if (!user) {
        updateHighlights(user?.uid, uuid, highlightCache);
      }

      // Update local state
      updateEntry(uuid, { highlightCache: highlightCache ?? null });
    },
    [user, updateEntry]
  );

  // Update output
  const updateEntryOutput = useCallback(
    (uuid: string, docId: string | null, output: string) => {
      // Update repository (fire and forget)
      updateOutput(user?.uid, uuid, docId, output);

      // Update local state
      updateEntry(uuid, { output });
    },
    [user, updateEntry]
  );

  // Clear all history
  const clearHistory = useCallback(async () => {
    log.debug('Clearing history', {
      hasUser: !!user,
      currentCount: state.history.length,
    });

    await clearAll(user?.uid);
    clearEntries();
    toast.success('History cleared');
  }, [user, toast, clearEntries, state.history.length]);

  // Delete a single prompt from history
  const deleteFromHistory = useCallback(
    async (entryId: string) => {
      log.debug('Deleting from history', { entryId, hasUser: !!user });

      // Optimistic update
      removeEntry(entryId);

      try {
        await deleteEntry(user?.uid, entryId);
        toast.success('Prompt deleted');
      } catch (error) {
        log.error('Error deleting prompt', error as Error, {
          entryId,
          userId: user?.uid,
        });

        // Revert optimistic update on error
        if (user) {
          await loadHistoryFromFirestore(user.uid);
        } else {
          const entries = await loadFromLocalStorage();
          setHistory(entries);
        }

        toast.error('Failed to delete prompt');
      }
    },
    [user, toast, removeEntry, loadHistoryFromFirestore, setHistory]
  );

  return {
    history: state.history,
    filteredHistory,
    isLoadingHistory: state.isLoadingHistory,
    searchQuery,
    setSearchQuery,
    saveToHistory,
    clearHistory,
    deleteFromHistory,
    loadHistoryFromFirestore,
    updateEntryHighlight,
    updateEntryOutput,
  };
};
