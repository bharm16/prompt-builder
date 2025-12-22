/**
 * Property-based tests for Clipboard Error Handling
 *
 * Tests the following correctness property:
 * - Property 9: Clipboard Errors Don't Crash
 *
 * @module ClipboardErrorHandling.property.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

import { SuggestionsList } from '@components/SuggestionsPanel/components/SuggestionsList';
import type { SuggestionItem } from '@components/SuggestionsPanel/hooks/types';

// Mock the useToast hook
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('@components/Toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Clipboard Error Handling Property Tests', () => {
  /**
   * Property 9: Clipboard Errors Don't Crash
   *
   * For any clipboard write failure, the component SHALL catch the error and
   * continue functioning without throwing to the React error boundary.
   *
   * **Feature: ai-suggestions-fixes, Property 9: Clipboard Errors Don't Crash**
   * **Validates: Requirements 9.2**
   */
  describe("Property 9: Clipboard Errors Don't Crash", () => {
    let originalClipboard: Clipboard | undefined;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Store original clipboard
      originalClipboard = navigator.clipboard;
      // Spy on console.warn to verify logging
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Clear mock calls
      mockToast.success.mockClear();
      mockToast.error.mockClear();
    });

    afterEach(() => {
      // Restore original clipboard
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: originalClipboard,
          writable: true,
          configurable: true,
        });
      }
      consoleWarnSpy.mockRestore();
      vi.clearAllMocks();
      cleanup();
    });

    it('component continues functioning when clipboard.writeText throws', async () => {
      // Mock clipboard to throw an error
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard access denied')),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [
        { text: 'Test suggestion 1' },
        { text: 'Test suggestion 2' },
      ];

      const onSuggestionClick = vi.fn();

      // Render should not throw
      const { container } = render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={onSuggestionClick}
          showCopyAction={true}
        />
      );

      // Component should render
      expect(container).toBeTruthy();

      // Find and click the copy button
      const copyButtons = screen.getAllByRole('button', { name: /copy suggestion/i });
      expect(copyButtons.length).toBeGreaterThan(0);

      // Click should not throw
      fireEvent.click(copyButtons[0]);

      // Wait for async clipboard operation to complete
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Component should still be rendered and functional
      expect(container.querySelector('[role="list"]')).toBeTruthy();
    });

    it('component handles Permission denied error without crashing', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      const { container } = render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={vi.fn()}
          showCopyAction={true}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Component should still be rendered
      expect(container.querySelector('[role="list"]')).toBeTruthy();
    });

    it('component handles DOMException without crashing', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new DOMException('NotAllowedError')),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      const { container } = render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={vi.fn()}
          showCopyAction={true}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Component should still be rendered
      expect(container.querySelector('[role="list"]')).toBeTruthy();
    });

    it('component handles TypeError without crashing', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new TypeError('Cannot read clipboard')),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      const { container } = render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={vi.fn()}
          showCopyAction={true}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Component should still be rendered
      expect(container.querySelector('[role="list"]')).toBeTruthy();
    });

    it('component handles clipboard API being undefined', () => {
      // Remove clipboard API entirely
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      // Render should not throw
      const { container } = render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={vi.fn()}
          showCopyAction={true}
        />
      );

      // Component should render
      expect(container).toBeTruthy();

      // Find and click the copy button - should not throw
      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      expect(() => fireEvent.click(copyButton)).not.toThrow();

      // Component should still be rendered
      expect(container.querySelector('[role="list"]')).toBeTruthy();
    });

    it('suggestion click still works after clipboard error', async () => {
      // Mock clipboard to throw an error
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      const onSuggestionClick = vi.fn();

      render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={onSuggestionClick}
          showCopyAction={true}
        />
      );

      // Click copy button (which will fail)
      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      fireEvent.click(copyButton);

      // Wait for async operation
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Now click the main suggestion button - should still work
      const suggestionButton = screen.getByRole('button', { name: /apply suggestion/i });
      fireEvent.click(suggestionButton);

      expect(onSuggestionClick).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Test suggestion' })
      );
    });

    it('shows error toast when clipboard write fails', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Test clipboard error')),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={vi.fn()}
          showCopyAction={true}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      fireEvent.click(copyButton);

      // Wait for async operation and error toast
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to copy', 1500);
      });
    });

    it('shows success toast when clipboard write succeeds', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn(),
        read: vi.fn(),
        write: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const suggestions: SuggestionItem[] = [{ text: 'Test suggestion' }];

      render(
        <SuggestionsList
          suggestions={suggestions}
          onSuggestionClick={vi.fn()}
          showCopyAction={true}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy suggestion/i });
      fireEvent.click(copyButton);

      // Wait for async operation and success toast
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Copied to clipboard!', 1500);
      });
    });
  });
});
