export { default } from './KeyboardShortcuts';
export { default as KeyboardShortcuts } from './KeyboardShortcuts';

// Re-export config
export { SHORTCUTS, formatShortcut, isMac, modKey } from './shortcuts.config';
export type { ShortcutItem, ShortcutCategory } from './shortcuts.config';

// Re-export hook
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export type { KeyboardShortcutsCallbacks } from './hooks/useKeyboardShortcuts';
