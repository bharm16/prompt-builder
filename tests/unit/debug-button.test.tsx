import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import DebugButton from '@/components/DebugButton';
import { usePromptDebugger } from '@/hooks/usePromptDebugger';
import { logger } from '@/services/LoggingService';

vi.mock('@/hooks/usePromptDebugger', () => ({
  usePromptDebugger: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('DebugButton', () => {
  const mockUsePromptDebugger = vi.mocked(usePromptDebugger);
  const mockLogger = vi.mocked(logger);
  const createDebuggerHookResult = (
    overrides: Partial<ReturnType<typeof usePromptDebugger>> = {}
  ): ReturnType<typeof usePromptDebugger> => ({
    capturePromptData: vi.fn(),
    exportToFile: vi.fn(),
    exportAllCaptures: vi.fn(),
    isCapturing: false,
    lastCapture: null,
    debugger: {} as ReturnType<typeof usePromptDebugger>['debugger'],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  describe('error handling', () => {
    it('alerts and logs when capture fails', async () => {
      const capturePromptData = vi.fn().mockRejectedValue(new Error('capture failed'));
      mockUsePromptDebugger.mockReturnValue(createDebuggerHookResult({
        capturePromptData,
        exportToFile: vi.fn(),
        isCapturing: false,
      }));

      render(<DebugButton inputPrompt="Prompt" />);

      fireEvent.click(screen.getByRole('button', { name: /debug capture/i }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          'Failed to capture debug data. Check console for details.'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to capture debug data',
          expect.any(Error),
          expect.objectContaining({ component: 'DebugButton', operation: 'handleCapture' })
        );
      });
    });

    it('alerts and logs when export fails', async () => {
      mockUsePromptDebugger.mockReturnValue(createDebuggerHookResult({
        capturePromptData: vi.fn(),
        exportToFile: vi.fn(() => {
          throw new Error('no data');
        }),
        isCapturing: false,
      }));

      render(<DebugButton inputPrompt="Prompt" />);

      fireEvent.click(screen.getByRole('button', { name: /export json/i }));

      expect(window.alert).toHaveBeenCalledWith('No debug data to export. Capture data first.');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to export debug data',
        expect.any(Error),
        expect.objectContaining({ component: 'DebugButton', operation: 'handleExport' })
      );
    });
  });

  describe('edge cases', () => {
    it('disables capture button while capturing', () => {
      mockUsePromptDebugger.mockReturnValue(createDebuggerHookResult({
        capturePromptData: vi.fn(),
        exportToFile: vi.fn(),
        isCapturing: true,
      }));

      render(<DebugButton inputPrompt="Prompt" />);

      const captureButton = screen.getByText('Capturing...').closest('button');
      if (!captureButton) {
        throw new Error('Capture button not found');
      }
      expect(captureButton).toBeDisabled();
      expect(screen.getByText('Capturing...')).toBeInTheDocument();
    });

    it('does not trigger capture when disabled', async () => {
      const capturePromptData = vi.fn();
      mockUsePromptDebugger.mockReturnValue(createDebuggerHookResult({
        capturePromptData,
        exportToFile: vi.fn(),
        isCapturing: true,
      }));

      render(<DebugButton inputPrompt="Prompt" />);

      const captureButton = screen.getByText('Capturing...').closest('button');
      if (!captureButton) {
        throw new Error('Capture button not found');
      }
      fireEvent.click(captureButton);

      expect(capturePromptData).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('invokes capture when requested', async () => {
      const capturePromptData = vi.fn().mockResolvedValue({});
      mockUsePromptDebugger.mockReturnValue(createDebuggerHookResult({
        capturePromptData,
        exportToFile: vi.fn(),
        isCapturing: false,
      }));

      render(<DebugButton inputPrompt="Prompt" />);

      fireEvent.click(screen.getByRole('button', { name: /debug capture/i }));

      expect(capturePromptData).toHaveBeenCalled();
      expect(screen.getByText('Debug Capture')).toBeInTheDocument();
    });
  });
});
