import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useEditHistory } from '@features/prompt-optimizer/hooks/useEditHistory';

describe('useEditHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('adds edits and returns recent edits', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => {
      result.current.addEdit({
        original: 'Old',
        replacement: 'New',
        category: 'style',
        position: 5,
      });
    });

    expect(result.current.editCount).toBe(1);
    const recent = result.current.getRecentEdits(1);
    expect(recent[0]?.original).toBe('Old');
    expect(result.current.hasEdited('new')).toBe(true);
  });

  it('skips edits when original and replacement are identical', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => {
      result.current.addEdit({ original: 'same', replacement: 'same' });
    });

    expect(result.current.editCount).toBe(0);
  });

  it('supports undo and redo for saved prompt states', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => {
      result.current.saveState('first');
      result.current.saveState('second');
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      const undone = result.current.undo();
      expect(undone?.prompt).toBe('first');
    });
    act(() => {
      const redone = result.current.redo();
      expect(redone?.prompt).toBe('second');
    });
  });
});
