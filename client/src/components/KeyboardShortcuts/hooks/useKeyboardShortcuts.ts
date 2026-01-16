import { useEffect, useRef } from 'react';
import { isMac } from '../shortcuts.config';

export interface KeyboardShortcutsCallbacks {
  openShortcuts?: () => void;
  openSettings?: () => void;
  createNew?: () => void;
  optimize?: () => void;
  improveFirst?: () => void;
  canCopy?: () => boolean;
  copy?: () => void;
  export?: () => void;
  toggleSidebar?: () => void;
  switchMode?: (index: number) => void;
  applySuggestion?: (index: number) => void;
  closeModal?: () => void;
}

/**
 * Custom hook for handling keyboard shortcuts.
 * Registers global keyboard event listeners for app-wide shortcuts.
 */
export function useKeyboardShortcuts(callbacks: KeyboardShortcutsCallbacks): void {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const activeCallbacks = callbacksRef.current;
      const isMod = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + K - Open shortcuts
      if (isMod && e.key === 'k') {
        e.preventDefault();
        activeCallbacks.openShortcuts?.();
      }

      // Cmd/Ctrl + , - Open settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        activeCallbacks.openSettings?.();
      }

      // Cmd/Ctrl + N - New prompt
      if (isMod && e.key === 'n') {
        e.preventDefault();
        activeCallbacks.createNew?.();
      }

      // Cmd/Ctrl + Enter - Optimize
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        activeCallbacks.optimize?.();
      }

      // Cmd/Ctrl + C - Copy (only in results view and only when no text is selected)
      if (isMod && e.key === 'c' && activeCallbacks.canCopy?.()) {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        // Only intercept if there's no text selection
        if (!selectedText) {
          e.preventDefault();
          activeCallbacks.copy?.();
        }
      }

      // Cmd/Ctrl + E - Export
      if (isMod && e.key === 'e') {
        e.preventDefault();
        activeCallbacks.export?.();
      }

      // Cmd/Ctrl + B - Toggle sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault();
        activeCallbacks.toggleSidebar?.();
      }

      // Cmd/Ctrl + 1-5 - Switch modes
      if (isMod && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const modeIndex = parseInt(e.key) - 1;
        activeCallbacks.switchMode?.(modeIndex);
      }

      // Alt + 1-9 - Apply suggestions
      if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const suggestionIndex = parseInt(e.key) - 1;
        activeCallbacks.applySuggestion?.(suggestionIndex);
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        activeCallbacks.closeModal?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
