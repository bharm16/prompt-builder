import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

function dispatchKey(key: string, options?: Partial<KeyboardEvent>): { preventDefault: ReturnType<typeof vi.fn> } {
  const event = new KeyboardEvent('keydown', { key, ...options });
  const preventDefault = vi.fn();
  Object.defineProperty(event, 'preventDefault', { value: preventDefault });
  window.dispatchEvent(event);
  return { preventDefault };
}

describe('useKeyboardShortcuts', () => {
  const onSuggestionSelect = vi.fn();
  const onEscape = vi.fn();
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('ignores key presses when there is no active element', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onSuggestionSelect,
          onEscape,
          onRefresh,
          activeElement: null,
          suggestions: ['one'],
        })
      );

      dispatchKey('1');
      dispatchKey('Escape');

      expect(onSuggestionSelect).not.toHaveBeenCalled();
      expect(onEscape).not.toHaveBeenCalled();
    });

    it('ignores number keys when suggestions are empty', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onSuggestionSelect,
          onEscape,
          onRefresh,
          activeElement: 'subject',
          suggestions: [],
        })
      );

      dispatchKey('1');

      expect(onSuggestionSelect).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('ignores number keys outside the allowed range', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onSuggestionSelect,
          onEscape,
          onRefresh,
          activeElement: 'subject',
          suggestions: ['one', 'two'],
        })
      );

      dispatchKey('5');

      expect(onSuggestionSelect).not.toHaveBeenCalled();
    });

    it('does not refresh when modifier keys are pressed with r', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onSuggestionSelect,
          onEscape,
          onRefresh,
          activeElement: 'subject',
          suggestions: ['one'],
        })
      );

      dispatchKey('r', { ctrlKey: true });
      dispatchKey('r', { metaKey: true });

      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('selects suggestion by number key and prevents default', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onSuggestionSelect,
          onEscape,
          onRefresh,
          activeElement: 'subject',
          suggestions: ['first', 'second'],
        })
      );

      const { preventDefault } = dispatchKey('1');

      expect(preventDefault).toHaveBeenCalled();
      expect(onSuggestionSelect).toHaveBeenCalledWith('first');
    });

    it('handles escape and refresh shortcuts when active', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onSuggestionSelect,
          onEscape,
          onRefresh,
          activeElement: 'subject',
          suggestions: ['first'],
        })
      );

      dispatchKey('Escape');
      const { preventDefault } = dispatchKey('r');

      expect(onEscape).toHaveBeenCalled();
      expect(onRefresh).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });
  });
});
