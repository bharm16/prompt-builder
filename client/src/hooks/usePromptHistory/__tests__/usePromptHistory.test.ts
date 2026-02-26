import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptHistoryEntry, Toast, User } from '../types';

const {
  mockUseToast,
  mockUseHistoryState,
  mockUseHistoryPersistence,
  stateFns,
  persistenceFns,
} = vi.hoisted(() => {
  const toast: Toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const stateFns = {
    state: {
      history: [] as PromptHistoryEntry[],
      isLoadingHistory: false,
      searchQuery: '',
    },
    setHistory: vi.fn(),
    addEntry: vi.fn(),
    updateEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearEntries: vi.fn(),
    setIsLoadingHistory: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filteredHistory: [] as PromptHistoryEntry[],
  };

  const persistenceFns = {
    loadHistoryFromFirestore: vi.fn().mockResolvedValue(undefined),
    loadHistoryFromLocalStorage: vi.fn().mockResolvedValue(undefined),
    saveToHistory: vi.fn(),
    createDraft: vi.fn(),
    updateEntryLocal: vi.fn(),
    updateEntryPersisted: vi.fn(),
    updateEntryHighlight: vi.fn(),
    updateEntryOutput: vi.fn(),
    updateEntryVersions: vi.fn(),
    clearHistory: vi.fn(),
    deleteFromHistory: vi.fn(),
  };

  return {
    mockUseToast: vi.fn().mockReturnValue(toast),
    mockUseHistoryState: vi.fn().mockReturnValue(stateFns),
    mockUseHistoryPersistence: vi.fn().mockReturnValue(persistenceFns),
    stateFns,
    persistenceFns,
  };
});

vi.mock('../../../components/Toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('../hooks', () => ({
  useHistoryState: mockUseHistoryState,
  useHistoryPersistence: mockUseHistoryPersistence,
}));

import { usePromptHistory } from '../usePromptHistory';

describe('usePromptHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    stateFns.state = {
      history: [{ id: '1', uuid: 'uuid-1', input: 'input', output: 'output' }],
      isLoadingHistory: false,
      searchQuery: '',
    };
    stateFns.searchQuery = '';
    stateFns.filteredHistory = stateFns.state.history;

    mockUseHistoryState.mockReturnValue(stateFns);
    mockUseHistoryPersistence.mockReturnValue(persistenceFns);
  });

  it('loads firestore after delay when user is provided and sets loading immediately', async () => {
    vi.useFakeTimers();
    const user: User = { uid: 'user-1' };

    renderHook(() => usePromptHistory(user));

    expect(stateFns.setIsLoadingHistory).toHaveBeenCalledWith(true);
    expect(persistenceFns.loadHistoryFromFirestore).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(persistenceFns.loadHistoryFromFirestore).toHaveBeenCalledWith('user-1');
  });

  it('cancels delayed firestore load on unmount', async () => {
    vi.useFakeTimers();
    const user: User = { uid: 'user-2' };

    const { unmount } = renderHook(() => usePromptHistory(user));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(persistenceFns.loadHistoryFromFirestore).not.toHaveBeenCalled();
  });

  it('loads from localStorage immediately when user is null', () => {
    renderHook(() => usePromptHistory(null));

    expect(persistenceFns.loadHistoryFromLocalStorage).toHaveBeenCalledTimes(1);
    expect(stateFns.setIsLoadingHistory).not.toHaveBeenCalled();
  });

  it('passes state and persistence actions through return contract', () => {
    const { result } = renderHook(() => usePromptHistory(null));

    expect(result.current.history).toBe(stateFns.state.history);
    expect(result.current.filteredHistory).toBe(stateFns.filteredHistory);
    expect(result.current.isLoadingHistory).toBe(stateFns.state.isLoadingHistory);
    expect(result.current.searchQuery).toBe(stateFns.searchQuery);
    expect(result.current.setSearchQuery).toBe(stateFns.setSearchQuery);
    expect(result.current.saveToHistory).toBe(persistenceFns.saveToHistory);
    expect(result.current.createDraft).toBe(persistenceFns.createDraft);
    expect(result.current.updateEntryLocal).toBe(persistenceFns.updateEntryLocal);
    expect(result.current.updateEntryPersisted).toBe(persistenceFns.updateEntryPersisted);
    expect(result.current.clearHistory).toBe(persistenceFns.clearHistory);
    expect(result.current.deleteFromHistory).toBe(persistenceFns.deleteFromHistory);
    expect(result.current.loadHistoryFromFirestore).toBe(persistenceFns.loadHistoryFromFirestore);
    expect(result.current.updateEntryHighlight).toBe(persistenceFns.updateEntryHighlight);
    expect(result.current.updateEntryOutput).toBe(persistenceFns.updateEntryOutput);
    expect(result.current.updateEntryVersions).toBe(persistenceFns.updateEntryVersions);
  });

  it('wires toast into useHistoryPersistence options', () => {
    const user: User = { uid: 'user-toast' };
    renderHook(() => usePromptHistory(user));

    expect(mockUseHistoryPersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        history: stateFns.state.history,
        isLoadingHistory: stateFns.state.isLoadingHistory,
        toast: expect.objectContaining({
          success: expect.any(Function),
          error: expect.any(Function),
          warning: expect.any(Function),
          info: expect.any(Function),
        }),
      })
    );
  });
});
