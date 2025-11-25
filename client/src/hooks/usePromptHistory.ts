import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { getPromptRepositoryForUser } from '../repositories';
import type { User, PromptHistoryEntry, Toast } from './types';

export const usePromptHistory = (user: User | null) => {
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toast = useToast() as Toast;

  // Load history from repository
  const loadHistoryFromFirestore = useCallback(
    async (userId: string) => {
      setIsLoadingHistory(true);
      try {
        const repository = getPromptRepositoryForUser(true); // Authenticated
        const prompts = await repository.getUserPrompts(userId, 100);

        const normalizedPrompts: PromptHistoryEntry[] = prompts.map((entry) => ({
          ...entry,
          brainstormContext: entry.brainstormContext ?? null,
          highlightCache: entry.highlightCache ?? null,
          versions: entry.versions ?? [],
        }));
        setHistory(normalizedPrompts);

        // Also update localStorage with the latest from Firestore
        if (normalizedPrompts.length > 0) {
          try {
            localStorage.setItem('promptHistory', JSON.stringify(normalizedPrompts));
          } catch (e) {
            if (e instanceof Error && e.name === 'QuotaExceededError') {
              // Try to free up space by keeping only recent 50 items
              const trimmed = normalizedPrompts.slice(0, 50);
              try {
                localStorage.setItem('promptHistory', JSON.stringify(trimmed));
                toast.warning('Storage limit reached. Keeping only recent 50 items.');
              } catch (retryError) {
                console.error('Unable to save to localStorage even after trimming:', retryError);
                toast.error('Browser storage full. Please clear browser data.');
              }
            } else {
              console.warn('Could not save to localStorage:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading history:', error);

        // Try to load from localStorage as fallback
        try {
          const localRepository = getPromptRepositoryForUser(false);
          const localHistory = await localRepository.getUserPrompts('', 100);
          const normalizedHistory: PromptHistoryEntry[] = localHistory.map((entry) => ({
            ...entry,
            brainstormContext: entry.brainstormContext ?? null,
            highlightCache: entry.highlightCache ?? null,
            versions: entry.versions ?? [],
          }));
          setHistory(normalizedHistory);
        } catch (localError) {
          console.error('Error loading from localStorage fallback:', localError);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [toast]
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
      const loadLocalHistory = async () => {
        try {
          const repository = getPromptRepositoryForUser(false);
          const localHistory = await repository.getUserPrompts('', 100);
          const normalizedHistory: PromptHistoryEntry[] = localHistory.map((entry) => ({
            ...entry,
            brainstormContext: entry.brainstormContext ?? null,
            highlightCache: entry.highlightCache ?? null,
            versions: entry.versions ?? [],
          }));
          setHistory(normalizedHistory);
        } catch (error) {
          console.error('Error loading history from localStorage:', error);
        }
      };
      loadLocalHistory();
    }
  }, [user, loadHistoryFromFirestore]);

  // Save to history
  const saveToHistory = useCallback(
    async (
      input: string,
      output: string,
      score: number | null,
      selectedMode: string,
      brainstormContext: unknown = null,
      highlightCache: unknown = null
    ): Promise<{ uuid: string; id: string } | null> => {
      const newEntry: Omit<PromptHistoryEntry, 'id' | 'uuid' | 'timestamp'> = {
        input,
        output,
        score: score ?? null,
        mode: selectedMode,
        brainstormContext: brainstormContext ?? null,
        highlightCache: highlightCache ?? null,
      };

      const repository = getPromptRepositoryForUser(!!user);

      try {
        const result = await repository.save(user?.uid ?? '', newEntry);
        const entryWithId: PromptHistoryEntry = {
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => [entryWithId, ...prevHistory].slice(0, 100));
        return { uuid: result.uuid, id: result.id };
      } catch (error) {
        console.error('Error saving to history:', error);
        toast.error(user ? 'Failed to save to cloud' : 'Failed to save to history');
        return null;
      }
    },
    [user, toast]
  );

  const updateEntryHighlight = useCallback(
    (uuid: string, highlightCache: unknown) => {
      const repository = getPromptRepositoryForUser(!!user);

      // Update in repository
      // Note: updateHighlights signature varies between repository types
      if ('updateHighlights' in repository && typeof repository.updateHighlights === 'function') {
        const updateFn = repository.updateHighlights as (
          uuid: string,
          options: { highlightCache?: unknown; versionEntry?: unknown }
        ) => Promise<void>;
        updateFn(uuid, { highlightCache }).catch((error) => {
          console.warn('Unable to persist updated highlights:', error);
        });
      }

      // Update local state
      setHistory((prevHistory) => {
        return prevHistory.map((entry) =>
          entry.uuid === uuid ? { ...entry, highlightCache: highlightCache ?? null } : entry
        );
      });
    },
    [user]
  );

  // Clear all history
  const clearHistory = useCallback(async () => {
    const repository = getPromptRepositoryForUser(!!user);
    // Note: clear() method may not exist on all repository types
    if ('clear' in repository && typeof repository.clear === 'function') {
      await repository.clear();
    }
    setHistory([]);
    toast.success('History cleared');
  }, [user, toast]);

  // Delete a single prompt from history
  const deleteFromHistory = useCallback(
    async (entryId: string) => {
      const repository = getPromptRepositoryForUser(!!user);

      // Optimistic update - remove from UI immediately
      setHistory((prevHistory) => prevHistory.filter((entry) => entry.id !== entryId));

      try {
        await repository.deleteById(entryId);
        toast.success('Prompt deleted');
      } catch (error) {
        console.error('Error deleting prompt:', error);

        // Revert optimistic update on error
        if (user) {
          await loadHistoryFromFirestore(user.uid);
        } else {
          const localRepository = getPromptRepositoryForUser(false);
          const localHistory = await localRepository.getUserPrompts('', 100);
          const normalizedHistory: PromptHistoryEntry[] = localHistory.map((entry) => ({
            ...entry,
            brainstormContext: entry.brainstormContext ?? null,
            highlightCache: entry.highlightCache ?? null,
            versions: entry.versions ?? [],
          }));
          setHistory(normalizedHistory);
        }

        toast.error('Failed to delete prompt');
      }
    },
    [user, toast, loadHistoryFromFirestore]
  );

  // Filter history based on search query with useMemo for performance
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(
      (entry) => entry.input.toLowerCase().includes(query) || entry.output.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  return {
    history,
    filteredHistory,
    isLoadingHistory,
    searchQuery,
    setSearchQuery,
    saveToHistory,
    clearHistory,
    deleteFromHistory,
    loadHistoryFromFirestore,
    updateEntryHighlight,
  };
};

