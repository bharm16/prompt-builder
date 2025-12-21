import React, { useEffect } from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { Button } from '../Button';
import { SHORTCUTS, formatShortcut, isMac } from './shortcuts.config';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * KeyboardShortcuts - Modal panel displaying available keyboard shortcuts.
 *
 * Shows all shortcuts grouped by category with platform-specific key labels.
 */
export default function KeyboardShortcuts({
  isOpen,
  onClose,
}: KeyboardShortcutsProps): React.ReactElement | null {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
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
      <div className="modal-content-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="card-header flex items-center justify-between bg-gradient-to-r from-primary-50 to-secondary-50">
          <div className="flex items-center gap-3">
            <Keyboard className="h-6 w-6 text-primary-600" aria-hidden="true" />
            <h2 id="shortcuts-title" className="text-xl font-bold text-neutral-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <Button
            onClick={onClose}
            svgOnly
            variant="secondary"
            size="small"
            prefix={<X className="h-5 w-5" />}
            aria-label="Close keyboard shortcuts"
          />
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
                      <span className="text-sm text-neutral-700">{shortcut.description}</span>
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
          <Button onClick={onClose} variant="primary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
