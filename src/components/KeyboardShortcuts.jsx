import React, { useEffect } from 'react';
import { X, Command, Keyboard } from 'lucide-react';

// Keyboard shortcuts configuration
export const SHORTCUTS = [
  {
    category: 'General',
    items: [
      { keys: ['Cmd', 'K'], description: 'Open keyboard shortcuts', id: 'shortcuts' },
      { keys: ['Cmd', ','], description: 'Open settings', id: 'settings' },
      { keys: ['Cmd', 'N'], description: 'Create new prompt', id: 'new' },
      { keys: ['Esc'], description: 'Close modal or panel', id: 'escape' },
    ],
  },
  {
    category: 'Prompt Actions',
    items: [
      { keys: ['Cmd', 'Enter'], description: 'Optimize prompt', id: 'optimize' },
      { keys: ['Cmd', 'I'], description: 'Improve prompt first', id: 'improve' },
      { keys: ['Shift', 'Enter'], description: 'New line in textarea', id: 'newline' },
    ],
  },
  {
    category: 'Results View',
    items: [
      { keys: ['Cmd', 'C'], description: 'Copy optimized prompt', id: 'copy' },
      { keys: ['Cmd', 'E'], description: 'Export prompt', id: 'export' },
      { keys: ['Cmd', 'S'], description: 'Save to history', id: 'save' },
      { keys: ['Cmd', 'Backspace'], description: 'Delete current prompt', id: 'delete' },
    ],
  },
  {
    category: 'Navigation',
    items: [
      { keys: ['Cmd', 'B'], description: 'Toggle history sidebar', id: 'sidebar' },
      { keys: ['Cmd', '1-5'], description: 'Switch prompt mode', id: 'mode' },
      { keys: ['Alt', '1-9'], description: 'Apply suggestion', id: 'suggestion' },
    ],
  },
];

// Detect if user is on Mac or Windows/Linux
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? 'Cmd' : 'Ctrl';

// Format shortcut keys for display
export const formatShortcut = (keys) => {
  return keys.map((key) => (key === 'Cmd' ? modKey : key));
};

// KeyboardShortcuts Panel Component
export default function KeyboardShortcuts({ isOpen, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="modal-content-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-header flex items-center justify-between bg-gradient-to-r from-primary-50 to-secondary-50">
          <div className="flex items-center gap-3">
            <Keyboard className="h-6 w-6 text-primary-600" aria-hidden="true" />
            <h2 id="shortcuts-title" className="text-xl font-bold text-neutral-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-secondary btn-sm"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="card-body max-h-[70vh] overflow-y-auto">
          <div className="space-y-8">
            {SHORTCUTS.map((category, idx) => (
              <section key={idx}>
                <h3 className="text-sm font-bold text-neutral-600 uppercase tracking-wider mb-4">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.items.map((shortcut, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors duration-150"
                    >
                      <span className="text-sm text-neutral-700">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {formatShortcut(shortcut.keys).map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <kbd
                              className="
                                inline-flex items-center justify-center
                                min-w-[2rem] h-8 px-2
                                text-xs font-semibold
                                bg-white
                                border-2 border-neutral-300
                                rounded-md shadow-sm
                                text-neutral-700
                              "
                            >
                              {key === 'Cmd' || key === 'Ctrl' ? (
                                <Command className="h-3.5 w-3.5" aria-label={key} />
                              ) : (
                                key
                              )}
                            </kbd>
                            {keyIdx < formatShortcut(shortcut.keys).length - 1 && (
                              <span className="text-neutral-400 mx-1" aria-hidden="true">
                                +
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="card-footer flex items-center justify-between">
          <p className="text-xs text-neutral-600">
            {isMac ? 'Using Mac keyboard layout' : 'Using Windows/Linux keyboard layout'}
          </p>
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom hook for handling keyboard shortcuts
export const useKeyboardShortcuts = (callbacks) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMod = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + K - Open shortcuts
      if (isMod && e.key === 'k') {
        e.preventDefault();
        callbacks.openShortcuts?.();
      }

      // Cmd/Ctrl + , - Open settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        callbacks.openSettings?.();
      }

      // Cmd/Ctrl + N - New prompt
      if (isMod && e.key === 'n') {
        e.preventDefault();
        callbacks.createNew?.();
      }

      // Cmd/Ctrl + Enter - Optimize
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        callbacks.optimize?.();
      }

      // Cmd/Ctrl + I - Improve first
      if (isMod && e.key === 'i') {
        e.preventDefault();
        callbacks.improveFirst?.();
      }

      // Cmd/Ctrl + C - Copy (only in results view and only when no text is selected)
      if (isMod && e.key === 'c' && callbacks.canCopy?.()) {
        // Check if there's a text selection
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // Only intercept if there's no text selection
        // This allows normal browser copy to work when text is selected
        if (!selectedText) {
          e.preventDefault();
          callbacks.copy?.();
        }
      }

      // Cmd/Ctrl + E - Export
      if (isMod && e.key === 'e') {
        e.preventDefault();
        callbacks.export?.();
      }

      // Cmd/Ctrl + B - Toggle sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault();
        callbacks.toggleSidebar?.();
      }

      // Cmd/Ctrl + 1-5 - Switch modes
      if (isMod && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const modeIndex = parseInt(e.key) - 1;
        callbacks.switchMode?.(modeIndex);
      }

      // Alt + 1-9 - Apply suggestions
      if (e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const suggestionIndex = parseInt(e.key) - 1;
        callbacks.applySuggestion?.(suggestionIndex);
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        callbacks.closeModal?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callbacks]);
};
