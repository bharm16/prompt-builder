import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  auth,
  savePromptToFirestore,
  getUserPrompts,
} from '../firebase';
import { useToast } from '../components/Toast';

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
      setHistory(prompts);

      // Also update localStorage with the latest from Firestore
      if (prompts.length > 0) {
        try {
          localStorage.setItem('promptHistory', JSON.stringify(prompts));
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
          console.log('Loaded history from localStorage fallback:', parsedHistory.length);
          setHistory(parsedHistory);
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
          setHistory(parsedHistory);
        }
      } catch (error) {
        console.error('Error loading history from localStorage:', error);
        localStorage.removeItem('promptHistory');
      }
    }
  }, [user, loadHistoryFromFirestore]);

  // Save to history
  const saveToHistory = useCallback(async (input, output, score, selectedMode) => {
    const newEntry = {
      input,
      output,
      score,
      mode: selectedMode,
    };

    if (user) {
      try {
        const docId = await savePromptToFirestore(user.uid, newEntry);
        const entryWithId = {
          id: docId,
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => [entryWithId, ...prevHistory].slice(0, 100));
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        toast.error('Failed to save to cloud');
      }
    } else {
      try {
        const entryWithLocalId = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => {
          const updatedHistory = [entryWithLocalId, ...prevHistory].slice(0, 100);
          localStorage.setItem('promptHistory', JSON.stringify(updatedHistory));
          return updatedHistory;
        });
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        toast.error('Failed to save to history');
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