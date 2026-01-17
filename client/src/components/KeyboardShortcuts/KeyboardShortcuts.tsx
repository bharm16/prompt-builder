import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Command, Search } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { Dialog, DialogContent } from '@promptstudio/system/components/ui/dialog';
import { Input } from '@promptstudio/system/components/ui/input';
import { SHORTCUTS, formatShortcut, isMac } from './shortcuts.config';
import './KeyboardShortcuts.css';

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
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const filteredShortcuts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return SHORTCUTS;
    return SHORTCUTS
      .map((category) => {
        const items = category.items.filter((shortcut) => {
          const haystack = `${shortcut.description} ${shortcut.keys.join(' ')}`.toLowerCase();
          return haystack.includes(trimmed);
        });
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [query]);

  const totalMatches = useMemo(
    () => filteredShortcuts.reduce((sum, category) => sum + category.items.length, 0),
    [filteredShortcuts]
  );

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="po-command__card po-modal po-surface po-surface--grad p-0 max-w-[720px] [&>button]:hidden">
        <div className="po-command__accent" aria-hidden="true" />
        <div className="po-command__header">
          <div className="po-command__title">
            <Command className="h-4 w-4" aria-hidden="true" />
            <span id="command-title">Command Palette</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="po-command__close"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="po-command__search" role="search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions"
            aria-label="Search actions"
            className="h-auto border-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="po-command__list" role="list">
          {totalMatches === 0 ? (
            <div className="po-command__empty">No matches for "{query.trim()}".</div>
          ) : (
            filteredShortcuts.map((category) => (
              <section key={category.category} className="po-command__section" aria-label={category.category}>
                <div className="po-command__section-title">{category.category}</div>
                <div className="po-command__items">
                  {category.items.map((shortcut) => {
                    const formattedKeys = formatShortcut(shortcut.keys);
                    return (
                      <div
                        key={shortcut.id}
                        className="po-command__item po-row po-row--interactive"
                        role="listitem"
                      >
                        <span>{shortcut.description}</span>
                        <div className="po-command__keys" aria-label={`Shortcut: ${shortcut.keys.join(' + ')}`}>
                          {formattedKeys.map((key, keyIdx) => (
                            <React.Fragment key={`${shortcut.id}-${key}`}>
                              <kbd className="po-command__key po-kbd">
                                {key === 'Cmd' || key === 'Ctrl' ? (
                                  <Command className="h-3 w-3" aria-label={key} />
                                ) : (
                                  key
                                )}
                              </kbd>
                              {keyIdx < formattedKeys.length - 1 && (
                                <span className="po-command__plus" aria-hidden="true">
                                  +
                                </span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="po-command__footer">
          <span>{isMac ? 'Mac layout' : 'Windows/Linux layout'}</span>
          <span>{totalMatches} actions</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
