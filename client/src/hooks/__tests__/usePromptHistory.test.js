import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptHistory } from '../usePromptHistory.js';

// Mock firebase deps used by hook
vi.mock('../../firebase', () => ({
  auth: { currentUser: null },
  savePromptToFirestore: vi.fn(async () => 'doc-1'),
  getUserPrompts: vi.fn(async () => [
    { id: '1', input: 'a', output: 'A', score: 50, mode: 'code' },
    { id: '2', input: 'b', output: 'B', score: 60, mode: 'code' },
  ]),
}));

// Mock Toast
vi.mock('../../components/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }) => children,
}));

describe('usePromptHistory', () => {
beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('loads history from Firestore when user is present', async () => {
    const user = { uid: 'user1' };
    const { result } = renderHook(() => usePromptHistory(user));

    // wait beyond the internal 500ms delay and async fetch
    await new Promise((r) => setTimeout(r, 700));
    await waitFor(() => {
      expect(result.current.history.length).toBeGreaterThan(0);
    });
  });

  it('saves to local history when no user', async () => {
    const { result } = renderHook(() => usePromptHistory(null));
    await act(async () => {
      await result.current.saveToHistory('in', 'out', 70, 'code');
    });
    expect(result.current.history.length).toBe(1);
    const stored = JSON.parse(localStorage.getItem('promptHistory'));
    expect(stored.length).toBe(1);
  });

  it('filters history by search query', async () => {
    const { result } = renderHook(() => usePromptHistory(null));
    await act(async () => {
      await result.current.saveToHistory('hello', 'world', 60, 'code');
      await result.current.saveToHistory('foo', 'bar', 60, 'code');
    });
    act(() => {
      result.current.setSearchQuery('hello');
    });
    expect(result.current.filteredHistory.length).toBe(1);
  });

  it('clears history and updates storage', () => {
    const { result } = renderHook(() => usePromptHistory(null));
    act(() => {
      localStorage.setItem('promptHistory', JSON.stringify([{ id: 1, input: 'x', output: 'y' }]))
    });
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history.length).toBe(0);
    expect(localStorage.getItem('promptHistory')).toBeNull();
  });
});
