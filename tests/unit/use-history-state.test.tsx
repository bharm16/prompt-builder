import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useHistoryState } from '@hooks/usePromptHistory/hooks/useHistoryState';

describe('useHistoryState', () => {
  const makeEntry = (overrides = {}) => ({
    id: `id-${Math.random()}`,
    uuid: `uuid-${Math.random()}`,
    timestamp: new Date().toISOString(),
    input: 'test input',
    output: 'test output',
    score: 80,
    mode: 'video',
    ...overrides,
  });

  describe('error and edge cases', () => {
    it('addEntry caps history at 100 entries', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.addEntry(makeEntry({ uuid: `uuid-${i}` }));
        }
      });

      expect(result.current.state.history.length).toBe(100);
    });

    it('addEntry prepends new entries (most recent first)', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ uuid: 'first' }));
      });
      act(() => {
        result.current.addEntry(makeEntry({ uuid: 'second' }));
      });

      expect(result.current.state.history[0]?.uuid).toBe('second');
      expect(result.current.state.history[1]?.uuid).toBe('first');
    });

    it('addEntry replaces an existing entry with the same uuid', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ id: 'first-id', uuid: 'same', output: 'first output' }));
      });
      act(() => {
        result.current.addEntry(makeEntry({ id: 'second-id', uuid: 'same', output: 'second output' }));
      });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0]?.id).toBe('second-id');
      expect(result.current.state.history[0]?.output).toBe('second output');
    });

    it('addEntry replaces an existing entry with the same id even if uuid differs', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ id: 'shared-id', uuid: 'first-uuid', output: 'first output' }));
      });
      act(() => {
        result.current.addEntry(makeEntry({ id: 'shared-id', uuid: 'second-uuid', output: 'second output' }));
      });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0]?.uuid).toBe('second-uuid');
      expect(result.current.state.history[0]?.output).toBe('second output');
    });

    it('setHistory removes duplicate entries by id/uuid', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.setHistory([
          makeEntry({ id: 'dup-id', uuid: 'uuid-a', output: 'newest' }),
          makeEntry({ id: 'dup-id', uuid: 'uuid-b', output: 'duplicate-by-id' }),
          makeEntry({ id: 'id-c', uuid: 'dup-uuid', output: 'uuid-source' }),
          makeEntry({ id: 'id-d', uuid: 'dup-uuid', output: 'duplicate-by-uuid' }),
          makeEntry({ id: 'id-e', uuid: 'uuid-e', output: 'unique' }),
        ]);
      });

      expect(result.current.state.history).toHaveLength(3);
      expect(result.current.state.history[0]?.output).toBe('newest');
      expect(result.current.state.history[1]?.output).toBe('uuid-source');
      expect(result.current.state.history[2]?.output).toBe('unique');
    });

    it('updateEntry with non-existent uuid leaves all entries unchanged', () => {
      const { result } = renderHook(() => useHistoryState());
      const entry = makeEntry({ uuid: 'existing' });

      act(() => { result.current.addEntry(entry); });
      act(() => { result.current.updateEntry('non-existent', { output: 'changed' }); });

      expect(result.current.state.history[0]?.output).toBe('test output');
    });

    it('removeEntry with non-existent id leaves all entries unchanged', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => { result.current.addEntry(makeEntry({ id: 'keep-me' })); });
      act(() => { result.current.removeEntry('ghost-id'); });

      expect(result.current.state.history).toHaveLength(1);
    });

    it('clearEntries empties history', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry());
        result.current.addEntry(makeEntry());
      });
      act(() => { result.current.clearEntries(); });

      expect(result.current.state.history).toHaveLength(0);
    });
  });

  describe('search filtering', () => {
    it('returns all entries when searchQuery is empty', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ input: 'alpha' }));
        result.current.addEntry(makeEntry({ input: 'beta' }));
      });

      expect(result.current.filteredHistory).toHaveLength(2);
    });

    it('filters entries by input text (case-insensitive)', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ input: 'A cowboy rides', output: 'optimized cowboy' }));
        result.current.addEntry(makeEntry({ input: 'Spaceship launches', output: 'optimized spaceship' }));
      });
      act(() => { result.current.setSearchQuery('cowboy'); });

      expect(result.current.filteredHistory).toHaveLength(1);
      expect(result.current.filteredHistory[0]?.input).toContain('cowboy');
    });

    it('filters entries by output text (case-insensitive)', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ input: 'something', output: 'DRAMATIC scene' }));
        result.current.addEntry(makeEntry({ input: 'other', output: 'quiet scene' }));
      });
      act(() => { result.current.setSearchQuery('dramatic'); });

      expect(result.current.filteredHistory).toHaveLength(1);
    });

    it('returns empty array when no entries match query', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => { result.current.addEntry(makeEntry({ input: 'hello', output: 'world' })); });
      act(() => { result.current.setSearchQuery('zzzzzzz'); });

      expect(result.current.filteredHistory).toHaveLength(0);
    });
  });

  describe('core state mutations', () => {
    it('updateEntry merges partial updates into matched entry', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => { result.current.addEntry(makeEntry({ uuid: 'target', score: 50 })); });
      act(() => { result.current.updateEntry('target', { score: 95, output: 'new output' }); });

      const updated = result.current.state.history.find((e) => e.uuid === 'target');
      expect(updated?.score).toBe(95);
      expect(updated?.output).toBe('new output');
      expect(updated?.input).toBe('test input'); // unchanged fields preserved
    });

    it('removeEntry removes entry by id', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => {
        result.current.addEntry(makeEntry({ id: 'a', uuid: 'ua' }));
        result.current.addEntry(makeEntry({ id: 'b', uuid: 'ub' }));
      });
      act(() => { result.current.removeEntry('a'); });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0]?.id).toBe('b');
    });

    it('setIsLoadingHistory updates loading state', () => {
      const { result } = renderHook(() => useHistoryState());

      act(() => { result.current.setIsLoadingHistory(true); });
      expect(result.current.state.isLoadingHistory).toBe(true);

      act(() => { result.current.setIsLoadingHistory(false); });
      expect(result.current.state.isLoadingHistory).toBe(false);
    });
  });
});
