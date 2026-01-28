import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useKeyboardShortcuts } from '@features/prompt-optimizer/PromptCanvas/hooks/useKeyboardShortcuts';

const createToast = () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

describe('useKeyboardShortcuts', () => {
  const originalPlatform = navigator.platform;

  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('handles undo shortcut', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const toast = createToast();

    renderHook(() =>
      useKeyboardShortcuts({
        canUndo: true,
        canRedo: false,
        onUndo,
        onRedo,
        toast,
      })
    );

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
    });

    document.dispatchEvent(event);

    expect(onUndo).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Undone');
  });

  it('handles redo shortcut', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const toast = createToast();

    renderHook(() =>
      useKeyboardShortcuts({
        canUndo: false,
        canRedo: true,
        onUndo,
        onRedo,
        toast,
      })
    );

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
    });

    document.dispatchEvent(event);

    expect(onRedo).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Redone');
  });

  it('ignores shortcuts when actions are unavailable', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const toast = createToast();

    renderHook(() =>
      useKeyboardShortcuts({
        canUndo: false,
        canRedo: false,
        onUndo,
        onRedo,
        toast,
      })
    );

    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
    });
    const redoEvent = new KeyboardEvent('keydown', {
      key: 'y',
      metaKey: true,
    });

    document.dispatchEvent(undoEvent);
    document.dispatchEvent(redoEvent);

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });
});
