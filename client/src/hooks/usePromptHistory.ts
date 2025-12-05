import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { getPromptRepositoryForUser } from '../repositories';
import { logger } from '../services/LoggingService';
import type { User, PromptHistoryEntry, Toast } from './types';

export const usePromptHistory = (user: User | null) => {
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toast = useToast() as Toast;

  // Load history from repository
  const loadHistoryFromFirestore = useCallback(
    async (userId: string) => {
      const startTime = performance.now();
      setIsLoadingHistory(true);
      
      logger.debug('Loading history from Firestore', {
        operation: 'loadHistoryFromFirestore',
        userId,
      });
      logger.startTimer('loadHistoryFromFirestore');

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

        const duration = logger.endTimer('loadHistoryFromFirestore');
        logger.info('History loaded successfully', {
          operation: 'loadHistoryFromFirestore',
          entryCount: normalizedPrompts.length,
          duration,
        });

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
                logger.error('Unable to save to localStorage even after trimming', retryError as Error, {
                  hook: 'usePromptHistory',
                  operation: 'loadHistoryFromFirestore',
                  userId,
                });
                toast.error('Browser storage full. Please clear browser data.');
              }
            } else {
              logger.warn('Could not save to localStorage', {
                hook: 'usePromptHistory',
                operation: 'loadHistoryFromFirestore',
                error: e instanceof Error ? e.message : String(e),
                errorName: e instanceof Error ? e.name : undefined,
              });
            }
          }
        }
      } catch (error) {
        logger.endTimer('loadHistoryFromFirestore');
        logger.error('Error loading history', error as Error, {
          hook: 'usePromptHistory',
          operation: 'loadHistoryFromFirestore',
          userId,
          duration: Math.round(performance.now() - startTime),
        });

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
          logger.error('Error loading from localStorage fallback', localError as Error, {
            hook: 'usePromptHistory',
            operation: 'loadHistoryFromFirestore',
            userId,
          });
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
          logger.error('Error loading history from localStorage', error as Error, {
            hook: 'usePromptHistory',
            operation: 'loadLocalHistory',
          });
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
      const startTime = performance.now();
      
      logger.debug('Saving to history', {
        operation: 'saveToHistory',
        mode: selectedMode,
        hasUser: !!user,
        inputLength: input.length,
        outputLength: output.length,
      });
      logger.startTimer('saveToHistory');

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
        
        const duration = logger.endTimer('saveToHistory');
        logger.info('Saved to history successfully', {
          operation: 'saveToHistory',
          uuid: result.uuid,
          duration,
        });
        
        return { uuid: result.uuid, id: result.id };
      } catch (error) {
        logger.endTimer('saveToHistory');
        logger.error('Error saving to history', error as Error, {
          hook: 'usePromptHistory',
          operation: 'saveToHistory',
          userId: user?.uid,
          mode: selectedMode,
          duration: Math.round(performance.now() - startTime),
        });
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
          logger.warn('Unable to persist updated highlights', {
            hook: 'usePromptHistory',
            operation: 'updateEntryHighlight',
            uuid,
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : undefined,
          });
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

  const updateEntryOutput = useCallback(
    (uuid: string, docId: string | null, output: string) => {
      const repository = getPromptRepositoryForUser(!!user);

      // Update in repository
      // Note: updateOutput signature varies between repository types
      // Firestore uses docId, localStorage uses uuid
      if ('updateOutput' in repository && typeof repository.updateOutput === 'function') {
        // Check if this is a Firestore repository (has collectionName property) or localStorage repository
        const isFirestoreRepo = 'collectionName' in repository && user;
        
        if (isFirestoreRepo && docId) {
          // Firestore repository - use docId
          const updateFn = repository.updateOutput as (docId: string, output: string) => Promise<void>;
          updateFn(docId, output).catch((error) => {
            logger.warn('Unable to persist updated output', {
              hook: 'usePromptHistory',
              operation: 'updateEntryOutput',
              uuid,
              docId,
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : undefined,
            });
          });
        } else {
          // LocalStorage repository - use uuid
          const updateFn = repository.updateOutput as (uuid: string, output: string) => Promise<void>;
          updateFn(uuid, output).catch((error) => {
            logger.warn('Unable to persist updated output', {
              hook: 'usePromptHistory',
              operation: 'updateEntryOutput',
              uuid,
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : undefined,
            });
          });
        }
      }

      // Update local state optimistically
      setHistory((prevHistory) => {
        return prevHistory.map((entry) =>
          entry.uuid === uuid ? { ...entry, output } : entry
        );
      });
    },
    [user]
  );

  // Clear all history
  const clearHistory = useCallback(async () => {
    const startTime = performance.now();
    
    logger.debug('Clearing history', {
      operation: 'clearHistory',
      hasUser: !!user,
      currentCount: history.length,
    });
    logger.startTimer('clearHistory');

    const repository = getPromptRepositoryForUser(!!user);
    // Note: clear() method may not exist on all repository types
    if ('clear' in repository && typeof repository.clear === 'function') {
      await repository.clear();
    }
    setHistory([]);
    
    const duration = logger.endTimer('clearHistory');
    logger.info('History cleared successfully', {
      operation: 'clearHistory',
      duration,
    });
    
    toast.success('History cleared');
  }, [user, toast, history.length]);

  // Delete a single prompt from history
  const deleteFromHistory = useCallback(
    async (entryId: string) => {
      const startTime = performance.now();
      
      logger.debug('Deleting from history', {
        operation: 'deleteFromHistory',
        entryId,
        hasUser: !!user,
      });
      logger.startTimer('deleteFromHistory');

      const repository = getPromptRepositoryForUser(!!user);

      // Optimistic update - remove from UI immediately
      setHistory((prevHistory) => prevHistory.filter((entry) => entry.id !== entryId));

      try {
        await repository.deleteById(entryId);
        
        const duration = logger.endTimer('deleteFromHistory');
        logger.info('Deleted from history successfully', {
          operation: 'deleteFromHistory',
          entryId,
          duration,
        });
        
        toast.success('Prompt deleted');
      } catch (error) {
        logger.endTimer('deleteFromHistory');
        logger.error('Error deleting prompt', error as Error, {
          hook: 'usePromptHistory',
          operation: 'deleteFromHistory',
          entryId,
          userId: user?.uid,
          duration: Math.round(performance.now() - startTime),
        });

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
    updateEntryOutput,
  };
};

