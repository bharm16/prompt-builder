import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  auth,
  savePromptToFirestore,
  getUserPrompts,
} from '../config/firebase';
import { useToast } from '../components/Toast';
import { v4 as uuidv4 } from 'uuid';

export const usePromptHistory = (user) => {
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toast = useToast();

  // Load history from Firestore
  const loadHistoryFromFirestore = useCallback(async (userId) => {
    console.log('Loading history from Firestore for user:', userId);
    setIsLoadingHistory(true);
    try {
      const prompts = await getUserPrompts(userId, 100);
      console.log('Successfully loaded prompts from Firestore:', prompts.length);
      const normalizedPrompts = prompts.map((entry) => ({
        ...entry,
        brainstormContext: entry.brainstormContext ?? null,
      }));
      setHistory(normalizedPrompts);

      // Also update localStorage with the latest from Firestore
      if (normalizedPrompts.length > 0) {
        try {
          localStorage.setItem('promptHistory', JSON.stringify(normalizedPrompts));
        } catch (e) {
          console.warn('Could not save to localStorage:', e);
        }
      }
    } catch (error) {
      console.error('Error loading history from Firestore:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        name: error.name
      });

      // Try to load from localStorage as fallback
      try {
        const savedHistory = localStorage.getItem('promptHistory');
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          const normalizedHistory = parsedHistory.map((entry) => ({
            ...entry,
            brainstormContext: entry.brainstormContext ?? null,
          }));
          console.log('Loaded history from localStorage fallback:', normalizedHistory.length);
          setHistory(normalizedHistory);
        }
      } catch (localError) {
        console.error('Error loading from localStorage fallback:', localError);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load localStorage history on mount and when user changes
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
      try {
        const savedHistory = localStorage.getItem('promptHistory');
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          const normalizedHistory = parsedHistory.map((entry) => ({
            ...entry,
            brainstormContext: entry.brainstormContext ?? null,
          }));
          setHistory(normalizedHistory);
        }
      } catch (error) {
        console.error('Error loading history from localStorage:', error);
        localStorage.removeItem('promptHistory');
      }
    }
  }, [user, loadHistoryFromFirestore]);

  // Save to history
  const saveToHistory = useCallback(async (
    input,
    output,
    score,
    selectedMode,
    brainstormContext = null
  ) => {
    const newEntry = {
      input,
      output,
      score,
      mode: selectedMode,
      brainstormContext: brainstormContext ?? null,
    };

    if (user) {
      try {
        const result = await savePromptToFirestore(user.uid, newEntry);
        const entryWithId = {
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => [entryWithId, ...prevHistory].slice(0, 100));
        return result.uuid;
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        toast.error('Failed to save to cloud');
        return null;
      }
    } else {
      try {
        const uuid = uuidv4();
        const entryWithLocalId = {
          id: Date.now(),
          uuid,
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => {
          const updatedHistory = [entryWithLocalId, ...prevHistory].slice(0, 100);
          localStorage.setItem('promptHistory', JSON.stringify(updatedHistory));
          return updatedHistory;
        });
        return uuid;
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        toast.error('Failed to save to history');
        return null;
      }
    }
  }, [user, toast]);

  // Clear all history
  const clearHistory = useCallback(() => {
    localStorage.removeItem('promptHistory');
    setHistory([]);
    toast.success('History cleared');
  }, [toast]);

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
    loadHistoryFromFirestore
  };
};
