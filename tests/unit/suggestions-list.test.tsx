/**
 * Unit tests for SuggestionsList
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import { SuggestionsList, generateSuggestionKey } from '@components/SuggestionsPanel/components/SuggestionsList';
import { simpleHash } from '@features/prompt-optimizer/utils/SuggestionCache';
import { logger } from '@/services/LoggingService';
import { useToast } from '@components/Toast';

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: vi.fn(),
  },
}));

vi.mock('@components/Toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const mockLogger = vi.mocked(logger);
const mockUseToast = vi.mocked(useToast);

describe('SuggestionsList', () => {
  const toastApi = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };
  let originalClipboard: typeof navigator.clipboard | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue(toastApi);
    originalClipboard = navigator.clipboard;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  describe('error handling', () => {
    it('logs a warning when clipboard API is unavailable', () => {
      const warn = vi.fn();
      mockLogger.child.mockReturnValue({ warn } as never);
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      render(
        <SuggestionsList
          suggestions={[{ text: 'First suggestion' }]}
          onSuggestionClick={vi.fn()}
          showCopyAction
        />
      );

      fireEvent.click(screen.getByLabelText('Copy suggestion 1'));

      expect(warn).toHaveBeenCalledWith('Clipboard API not available', {
        component: 'SuggestionsList',
      });
    });
  });

  describe('edge cases', () => {
    it('returns null when there are no suggestions', () => {
      const { container } = render(<SuggestionsList suggestions={[]} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('uses suggestion id when generating keys', () => {
      expect(generateSuggestionKey({ id: 'abc', text: 'Hi' }, 2)).toBe('abc');
    });
  });

  describe('core behavior', () => {
    it('generates a hash-based key when no id is provided', () => {
      const key = generateSuggestionKey({ text: 'Hello' }, 1);
      expect(key).toBe(`suggestion_${simpleHash('Hello')}_1`);
    });

    it('invokes suggestion click with normalized payload', () => {
      const onSuggestionClick = vi.fn();

      render(
        <SuggestionsList
          suggestions={['Refine tone']}
          onSuggestionClick={onSuggestionClick}
        />
      );

      fireEvent.click(screen.getByLabelText(/Apply suggestion/i));

      expect(onSuggestionClick).toHaveBeenCalledWith({ text: 'Refine tone' });
    });

    it('copies text to clipboard and shows feedback', async () => {
      const warn = vi.fn();
      mockLogger.child.mockReturnValue({ warn } as never);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      vi.useFakeTimers();

      render(
        <SuggestionsList
          suggestions={[{ text: 'Copy me' }]}
          onSuggestionClick={vi.fn()}
          showCopyAction
        />
      );

      fireEvent.click(screen.getByLabelText('Copy suggestion 1'));

      expect(writeText).toHaveBeenCalledWith('Copy me');
      expect(toastApi.success).toHaveBeenCalledWith('Copied to clipboard!', 1500);

      vi.runAllTimers();
      vi.useRealTimers();
    });
  });
});
