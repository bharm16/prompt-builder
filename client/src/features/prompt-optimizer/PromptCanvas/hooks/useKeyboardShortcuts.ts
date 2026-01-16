/**
 * useKeyboardShortcuts Hook
 * 
 * Handles keyboard shortcuts for undo/redo.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useEffect, useRef } from 'react';

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

export interface UseKeyboardShortcutsOptions {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  toast: ToastContextValue;
}

/**
 * Sets up keyboard shortcuts for undo/redo functionality.
 */
export function useKeyboardShortcuts({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  toast,
}: UseKeyboardShortcutsOptions): void {
  const optionsRef = useRef({ canUndo, canRedo, onUndo, onRedo, toast });

  useEffect(() => {
    optionsRef.current = { canUndo, canRedo, onUndo, onRedo, toast };
  }, [canUndo, canRedo, onUndo, onRedo, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const { canUndo: canUndoCurrent, canRedo: canRedoCurrent, onUndo: onUndoCurrent, onRedo: onRedoCurrent, toast: toastCurrent } =
        optionsRef.current;
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isMac =
        typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl + Z (without Shift)
      if (modifier && e.key === 'z' && !e.shiftKey) {
        if (canUndoCurrent) {
          e.preventDefault();
          onUndoCurrent();
          toastCurrent.info('Undone');
        }
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z OR Cmd/Ctrl + Y
      if ((modifier && e.shiftKey && e.key === 'z') || (modifier && e.key === 'y')) {
        if (canRedoCurrent) {
          e.preventDefault();
          onRedoCurrent();
          toastCurrent.info('Redone');
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

