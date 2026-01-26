import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ModelSelectorDropdown } from '@features/prompt-optimizer/components/ModelSelectorDropdown';
import { useModelRegistry } from '@features/prompt-optimizer/hooks/useModelRegistry';

vi.mock('@features/prompt-optimizer/hooks/useModelRegistry', () => ({
  useModelRegistry: vi.fn(),
}));

const mockUseModelRegistry = vi.mocked(useModelRegistry);

describe('ModelSelectorDropdown', () => {
  const models = [
    { id: 'model-1', label: 'Model One', provider: 'provider' },
  ];

  describe('error handling', () => {
    it('does not open when disabled', async () => {
      mockUseModelRegistry.mockReturnValue({ models, isLoading: false, error: null });
      const user = userEvent.setup();

      render(
        <ModelSelectorDropdown selectedModel="" onModelChange={vi.fn()} disabled />
      );

      await user.click(screen.getByRole('button'));

      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('closes the menu when clicking outside', async () => {
      mockUseModelRegistry.mockReturnValue({ models, isLoading: false, error: null });
      const user = userEvent.setup();

      render(
        <ModelSelectorDropdown selectedModel="" onModelChange={vi.fn()} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(screen.getByRole('listbox', { hidden: true })).toBeInTheDocument()
      );

      fireEvent.mouseDown(document.body);

      await waitFor(() =>
        expect(screen.queryByRole('listbox', { hidden: true })).toBeNull()
      );
    });
  });

  describe('core behavior', () => {
    it('fires onModelChange when selecting a model', async () => {
      mockUseModelRegistry.mockReturnValue({ models, isLoading: false, error: null });
      const onModelChange = vi.fn();
      const user = userEvent.setup();

      render(
        <ModelSelectorDropdown selectedModel="" onModelChange={onModelChange} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(screen.getByRole('listbox', { hidden: true })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByText('Model One'));

      expect(onModelChange).toHaveBeenCalledWith('model-1');
      expect(screen.queryByRole('listbox', { hidden: true })).toBeNull();
    });
  });
});
