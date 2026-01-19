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
import { v4 as uuidv4 } from 'uuid';
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
  updateVersions,
  updatePrompt,
  deleteEntry,
  clearAll,
} from './api';
import type { User, PromptHistoryEntry, PromptVersionEntry, Toast, SaveResult } from './types';
import type { UpdatePromptOptions } from '../../repositories/promptRepositoryTypes';

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
      targetModel: string | null = null,
      generationParams: Record<string, unknown> | null = null,
      brainstormContext: unknown = null,
      highlightCache: unknown = null,
      existingUuid: string | null = null,
      title: string | null = null
    ): Promise<SaveResult | null> => {
      const normalizedTargetModel =
        typeof targetModel === 'string' && targetModel.trim()
          ? targetModel.trim()
          : null;

      log.debug('Saving to history', {
        mode: selectedMode,
        targetModel: normalizedTargetModel,
        hasUser: !!user,
        inputLength: input.length,
      });

      try {
        const result = await saveEntry(user?.uid, {
          ...(existingUuid ? { uuid: existingUuid } : {}),
          ...(title !== null ? { title } : {}),
          input,
          output,
          score,
          mode: selectedMode,
          ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
          ...(generationParams ? { generationParams } : {}),
          brainstormContext,
          highlightCache,
        });

        const newEntry: PromptHistoryEntry = {
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          title,
          input,
          output,
          score,
          mode: selectedMode,
          ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
          generationParams: generationParams ?? null,
          brainstormContext: brainstormContext ?? null,
          highlightCache: highlightCache ?? null,
        };

        if (existingUuid && state.history.some((e) => e.uuid === existingUuid)) {
          updateEntry(existingUuid, newEntry);
        } else {
          addEntry(newEntry);
        }
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
    [user, toast, addEntry, updateEntry, state.history]
  );

  const createDraft = useCallback(
    (params: {
      mode: string;
      targetModel: string | null;
      generationParams: Record<string, unknown> | null;
      uuid?: string;
    }): SaveResult => {
      const uuid = typeof params.uuid === 'string' && params.uuid.trim() ? params.uuid.trim() : uuidv4();
      const id = `draft-${Date.now()}`;

      const entry: PromptHistoryEntry = {
        id,
        uuid,
        timestamp: new Date().toISOString(),
        title: null,
        input: '',
        output: '',
        score: null,
        mode: params.mode,
        targetModel: params.targetModel ?? null,
        generationParams: params.generationParams ?? null,
        brainstormContext: null,
        highlightCache: null,
        versions: [],
      };

      addEntry(entry);
      return { uuid, id };
    },
    [addEntry]
  );

  const updateEntryLocal = useCallback(
    (uuid: string, updates: Partial<PromptHistoryEntry>) => {
      updateEntry(uuid, updates);
    },
    [updateEntry]
  );

  // Update prompt details (persisted)
  const updateEntryPersisted = useCallback(
    (uuid: string, docId: string | null, updates: UpdatePromptOptions) => {
      // Update repository (fire and forget)
      updatePrompt(user?.uid, uuid, docId, updates);

      // Update local state (map UpdatePromptOptions to Partial<PromptHistoryEntry>)
      const localUpdates: Partial<PromptHistoryEntry> = {};
      if (updates.input !== undefined) localUpdates.input = updates.input;
      if (updates.title !== undefined) localUpdates.title = updates.title;
      if (updates.mode !== undefined) localUpdates.mode = updates.mode;
      if (updates.targetModel !== undefined) localUpdates.targetModel = updates.targetModel;
      if (updates.generationParams !== undefined) localUpdates.generationParams = updates.generationParams;

      updateEntry(uuid, localUpdates);
    },
    [user, updateEntry]
  );

  // Update highlight cache
  const updateEntryHighlight = useCallback(
    (uuid: string, highlightCache: unknown) => {
      // Update repository (fire and forget)
      updateHighlights(user?.uid, uuid, highlightCache);

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

  const updateEntryVersions = useCallback(
    (uuid: string, docId: string | null, versions: PromptVersionEntry[]) => {
      updateEntry(uuid, { versions });
      updateVersions(user?.uid, uuid, docId, versions);
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
