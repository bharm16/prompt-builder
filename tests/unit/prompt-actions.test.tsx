import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromptActions } from '@features/prompt-optimizer/components/PromptActions';
import { usePromptState } from '@features/prompt-optimizer/context/PromptStateContext';
import { AI_MODEL_URLS } from '@features/prompt-optimizer/components/constants';

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptState: vi.fn(),
}));

const mockUsePromptState = vi.mocked(usePromptState);

describe('PromptActions', () => {
  const baseProps = {
    onCopy: vi.fn(),
    onExport: vi.fn(),
    onCreateNew: vi.fn(),
    onShare: vi.fn(),
    copied: false,
    shared: false,
    showExportMenu: false,
    onToggleExportMenu: vi.fn(),
    showLegend: false,
    onToggleLegend: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: true,
    primaryVisible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('disables generate when no supported model is selected', async () => {
      mockUsePromptState.mockReturnValue({ selectedModel: undefined } as ReturnType<typeof usePromptState>);

      render(<PromptActions {...baseProps} />);

      const generateButton = screen.getByRole('button', { name: /Generate with model/i });
      expect(generateButton).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('closes export menu when clicking outside', () => {
      mockUsePromptState.mockReturnValue({ selectedModel: 'sora-2' } as ReturnType<typeof usePromptState>);
      const onToggleExportMenu = vi.fn();

      render(
        <PromptActions
          {...baseProps}
          showExportMenu
          onToggleExportMenu={onToggleExportMenu}
        />
      );

      fireEvent.mouseDown(document.body);

      expect(onToggleExportMenu).toHaveBeenCalledWith(false);
    });
  });

  describe('core behavior', () => {
    it('copies prompt and opens model URL for the selected model', async () => {
      mockUsePromptState.mockReturnValue({ selectedModel: 'sora-2' } as ReturnType<typeof usePromptState>);
      const user = userEvent.setup();
      const onCopy = vi.fn();
      const onToggleExportMenu = vi.fn();
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <PromptActions
          {...baseProps}
          onCopy={onCopy}
          onToggleExportMenu={onToggleExportMenu}
        />
      );

      await user.click(screen.getByRole('button', { name: /Generate with Sora/i }));

      expect(onCopy).toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(
        AI_MODEL_URLS['sora-2'],
        '_blank',
        'noopener,noreferrer'
      );
      expect(onToggleExportMenu).toHaveBeenCalledWith(false);

      openSpy.mockRestore();
    });
  });
});
