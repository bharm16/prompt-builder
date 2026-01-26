import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FloatingToolbar } from '@features/prompt-optimizer/components/FloatingToolbar';

describe('FloatingToolbar', () => {
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
  };

  describe('error handling', () => {
    it('closes the export menu when clicking outside', () => {
      const onToggleExportMenu = vi.fn();

      render(
        <FloatingToolbar
          {...baseProps}
          showExportMenu
          onToggleExportMenu={onToggleExportMenu}
        />
      );

      fireEvent.mouseDown(document.body);

      expect(onToggleExportMenu).toHaveBeenCalledWith(false);
    });
  });

  describe('edge cases', () => {
    it('disables undo/redo buttons when unavailable', () => {
      render(
        <FloatingToolbar
          {...baseProps}
          canUndo={false}
          canRedo={false}
        />
      );

      expect(screen.getByTitle('Undo')).toBeDisabled();
      expect(screen.getByTitle('Redo')).toBeDisabled();
    });
  });

  describe('core behavior', () => {
    it('calls onExport for selected format', async () => {
      const user = userEvent.setup();
      const onExport = vi.fn();
      render(
        <FloatingToolbar
          {...baseProps}
          showExportMenu
          onExport={onExport}
        />
      );

      await user.click(screen.getByText('Text (.txt)'));

      expect(onExport).toHaveBeenCalledWith('text');
    });
  });
});
