import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePromptHistory } from '../usePromptHistory';
import type { PromptHistoryEntry, User } from '../types';

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

const mockGetUserPrompts = vi.fn<[], Promise<PromptHistoryEntry[]>>();
const mockDeleteById = vi.fn<[], Promise<void>>();

vi.mock('../../repositories', () => ({
  getPromptRepositoryForUser: vi.fn(() => ({
    getUserPrompts: mockGetUserPrompts,
    deleteById: mockDeleteById,
    save: vi.fn(),
  })),
}));

const makeEntry = (id: string, overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry => ({
  id,
  uuid: `uuid-${id}`,
  input: 'prompt',
  output: 'optimized',
  score: null,
  mode: 'video',
  timestamp: new Date().toISOString(),
  brainstormContext: null,
  highlightCache: null,
  versions: [],
  ...overrides,
});

describe('usePromptHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('loads local history for unauthenticated users and deletes entries', async () => {
    mockGetUserPrompts.mockResolvedValueOnce([makeEntry('1'), makeEntry('2')]);

    const { result } = renderHook(() => usePromptHistory(null));

    // Let useEffect async load complete
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(result.current.history).toHaveLength(2);

    mockDeleteById.mockResolvedValueOnce();
    await act(async () => {
      await result.current.deleteFromHistory('1');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]?.id).toBe('2');
  });

  it('loads firestore history for authenticated users', async () => {
    mockGetUserPrompts.mockResolvedValueOnce([makeEntry('auth-1')]);
    const user: User = { uid: 'user-123' };

    const { result } = renderHook(() => usePromptHistory(user));

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]?.id).toBe('auth-1');
  });
});
