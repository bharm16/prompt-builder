/**
 * useHistoryState - State Management Hook
 *
 * Manages local state for prompt history:
 * - History entries array
 * - Loading state
 * - Search query and filtering
 */

import { useState, useMemo, useCallback } from 'react';
import type { PromptHistoryEntry, HistoryState } from '../types';

export interface UseHistoryStateReturn {
  state: HistoryState;
  setHistory: (history: PromptHistoryEntry[]) => void;
  addEntry: (entry: PromptHistoryEntry) => void;
  updateEntry: (uuid: string, updates: Partial<PromptHistoryEntry>) => void;
  removeEntry: (entryId: string) => void;
  clearEntries: () => void;
  setIsLoadingHistory: (loading: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredHistory: PromptHistoryEntry[];
}

const MAX_HISTORY_ENTRIES = 100;

/**
 * Hook for managing history state
 */
export function useHistoryState(): UseHistoryStateReturn {
  const [history, setHistoryInternal] = useState<PromptHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const setSearchQueryWithLog = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const setHistory = useCallback((newHistory: PromptHistoryEntry[]) => {
    setHistoryInternal(newHistory);
  }, []);

  const addEntry = useCallback((entry: PromptHistoryEntry) => {
    setHistoryInternal((prev) => [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES));
  }, []);

  const updateEntry = useCallback((uuid: string, updates: Partial<PromptHistoryEntry>) => {
    setHistoryInternal((prev) =>
      prev.map((entry) => (entry.uuid === uuid ? { ...entry, ...updates } : entry))
    );
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setHistoryInternal((prev) => prev.filter((entry) => entry.id !== entryId));
  }, []);

  const clearEntries = useCallback(() => {
    setHistoryInternal([]);
  }, []);

  // Memoized filtered history based on search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(
      (entry) =>
        entry.input.toLowerCase().includes(query) ||
        entry.output.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  const state: HistoryState = {
    history,
    isLoadingHistory,
    searchQuery,
  };

  return {
    state,
    setHistory,
    addEntry,
    updateEntry,
    removeEntry,
    clearEntries,
    setIsLoadingHistory,
    searchQuery,
    setSearchQuery: setSearchQueryWithLog,
    filteredHistory,
  };
}
