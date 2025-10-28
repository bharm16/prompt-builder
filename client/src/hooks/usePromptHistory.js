import { useState, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { getPromptRepositoryForUser } from '../repositories';

export const usePromptHistory = (user) => {
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toast = useToast();

  // Load history from repository
  const loadHistoryFromFirestore = useCallback(async (userId) => {
    console.log('Loading history for user:', userId);
    setIsLoadingHistory(true);
    try {
      const repository = getPromptRepositoryForUser(true); // Authenticated
      const prompts = await repository.getUserPrompts(userId, 100);
      console.log('Successfully loaded prompts:', prompts.length);

      // Debug: Check how many have highlightCache
      const withHighlights = prompts.filter(p => p.highlightCache?.spans?.length > 0).length;
      console.log(`Prompts with highlights: ${withHighlights}/${prompts.length}`);

      const normalizedPrompts = prompts.map((entry) => ({
        ...entry,
        brainstormContext: entry.brainstormContext ?? null,
        highlightCache: entry.highlightCache ?? null,
        versions: entry.versions ?? [],
      }));
      setHistory(normalizedPrompts);

      // Debug: Log first video prompt with highlights
      const firstVideoWithHighlights = normalizedPrompts.find(
        p => p.mode === 'video' && p.highlightCache?.spans?.length > 0
      );
      if (firstVideoWithHighlights) {
        console.log('Sample video prompt with highlights:', {
          id: firstVideoWithHighlights.id,
          mode: firstVideoWithHighlights.mode,
          spansCount: firstVideoWithHighlights.highlightCache.spans.length,
          hasSignature: !!firstVideoWithHighlights.highlightCache.signature,
        });
      }

      // Also update localStorage with the latest from Firestore
      if (normalizedPrompts.length > 0) {
        try {
          localStorage.setItem('promptHistory', JSON.stringify(normalizedPrompts));
        } catch (e) {
          console.warn('Could not save to localStorage:', e);
        }
      }
    } catch (error) {
      console.error('Error loading history:', error);

      // Try to load from localStorage as fallback
      try {
        const localRepository = getPromptRepositoryForUser(false);
        const localHistory = await localRepository.getUserPrompts(null, 100);
        const normalizedHistory = localHistory.map((entry) => ({
          ...entry,
          brainstormContext: entry.brainstormContext ?? null,
          highlightCache: entry.highlightCache ?? null,
          versions: entry.versions ?? [],
        }));
        console.log('Loaded history from localStorage fallback:', normalizedHistory.length);
        setHistory(normalizedHistory);
      } catch (localError) {
        console.error('Error loading from localStorage fallback:', localError);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load history on mount and when user changes
  useEffect(() => {
    if (user) {
      // Clear localStorage on mount when user is signed in
      localStorage.removeItem('promptHistory');
      console.log('Cleared localStorage on mount');

      // Wait a bit to ensure auth tokens are ready
      setTimeout(async () => {
        await loadHistoryFromFirestore(user.uid);
      }, 500);
    } else {
      // Load from localStorage for unauthenticated users
      const loadLocalHistory = async () => {
        try {
          const repository = getPromptRepositoryForUser(false);
          const localHistory = await repository.getUserPrompts(null, 100);
          const normalizedHistory = localHistory.map((entry) => ({
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
  const saveToHistory = useCallback(async (
    input,
    output,
    score,
    selectedMode,
    brainstormContext = null,
    highlightCache = null
  ) => {
    const newEntry = {
      input,
      output,
      score,
      mode: selectedMode,
      brainstormContext: brainstormContext ?? null,
      highlightCache: highlightCache ?? null,
    };

    const repository = getPromptRepositoryForUser(!!user);

    try {
      const result = await repository.save(user?.uid, newEntry);
      const entryWithId = {
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
  }, [user, toast]);

  const updateEntryHighlight = useCallback((uuid, highlightCache) => {
    const repository = getPromptRepositoryForUser(!!user);

    // Update in repository
    repository.updateHighlights(uuid, { highlightCache }).catch(error => {
      console.warn('Unable to persist updated highlights:', error);
    });

    // Update local state
    setHistory((prevHistory) => {
      return prevHistory.map((entry) =>
        entry.uuid === uuid
          ? { ...entry, highlightCache: highlightCache ?? null }
          : entry
      );
    });
  }, [user]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    const repository = getPromptRepositoryForUser(!!user);
    await repository.clear();
    setHistory([]);
    toast.success('History cleared');
  }, [user, toast]);

  // Filter history based on search query with useMemo for performance
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const query = searchQuery.toLowerCase();
    return history.filter((entry) =>
      entry.input.toLowerCase().includes(query) ||
      entry.output.toLowerCase().includes(query)
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
    loadHistoryFromFirestore,
    updateEntryHighlight,
  };
};
