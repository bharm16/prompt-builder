import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useEditHistory } from '../useEditHistory';

describe('useEditHistory', () => {
  it('initializes with empty edit and prompt history', () => {
    const { result } = renderHook(() => useEditHistory());

    expect(result.current.edits).toEqual([]);
    expect(result.current.editCount).toBe(0);
    expect(result.current.promptHistory).toEqual([]);
    expect(result.current.historyIndex).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('adds edits when original and replacement differ and enforces max size', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => {
      result.current.addEdit({
        original: 'old',
        replacement: 'new',
        category: 'lighting',
      });
      result.current.addEdit({
        original: 'same',
        replacement: 'same',
      });
    });

    expect(result.current.edits).toHaveLength(1);
    expect(result.current.edits[0]?.category).toBe('lighting');

    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.addEdit({
          original: `o${i}`,
          replacement: `n${i}`,
        });
      }
    });

    expect(result.current.edits).toHaveLength(50);
    expect(result.current.editCount).toBe(50);
  });

  it('saves prompt states and supports undo/redo navigation', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => {
      result.current.saveState('First', { tag: 'a' });
      result.current.saveState('Second', { tag: 'b' });
      result.current.saveState('Third', { tag: 'c' });
    });

    expect(result.current.historyIndex).toBe(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.getCurrentState()?.prompt).toBe('Third');

    let undoState;
    act(() => {
      undoState = result.current.undo();
    });

    expect(undoState?.prompt).toBe('Second');
    expect(result.current.canRedo).toBe(true);

    let redoState;
    act(() => {
      redoState = result.current.redo();
    });

    expect(redoState?.prompt).toBe('Third');
    expect(result.current.historyIndex).toBe(2);
  });

  it('clears prompt history while preserving edits', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => {
      result.current.saveState('First');
      result.current.addEdit({ original: 'a', replacement: 'b' });
    });

    act(() => {
      result.current.clearHistoryStates();
    });

    expect(result.current.promptHistory).toEqual([]);
    expect(result.current.historyIndex).toBe(-1);
    expect(result.current.edits).toHaveLength(1);
  });
});
