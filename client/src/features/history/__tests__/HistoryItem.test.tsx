import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HistoryItem } from '../components/HistoryItem';
import type { PromptHistoryEntry } from '@hooks/types';
import type { PromptRowStage } from '../types';

const createEntry = (overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry => ({
  id: 'entry-1',
  uuid: 'uuid-1',
  input: 'Prompt input',
  output: 'Prompt output',
  ...overrides,
});

// ============================================================================
// HistoryItem
// ============================================================================

describe('HistoryItem', () => {
  const baseProps = {
    entry: createEntry(),
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onRename: vi.fn(),
    onCopyPrompt: vi.fn(),
    onOpenInNewTab: vi.fn(),
    title: 'Sample Prompt',
    meta: 'Draft · 2 edits',
    stage: 'draft' as PromptRowStage,
  };

  describe('error handling', () => {
    it('requires confirmation before deleting and then deletes on confirm', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();

      render(
        <HistoryItem
          {...baseProps}
          onDelete={onDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Delete prompt' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByText('Delete this session?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledWith('entry-1');
    });

    it('handles retry for error stages without triggering delete flow', async () => {
      const onLoad = vi.fn();
      const user = userEvent.setup();

      render(
        <HistoryItem
          {...baseProps}
          onLoad={onLoad}
          stage="error"
        />
      );

      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(onLoad).toHaveBeenCalledWith(baseProps.entry);
      expect(screen.queryByText('Delete this session?')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('does not invoke open-in-new-tab when UUID is missing', async () => {
      const onOpenInNewTab = vi.fn();

      render(
        <HistoryItem
          {...baseProps}
          entry={createEntry({ uuid: '' })}
          onOpenInNewTab={onOpenInNewTab}
        />
      );

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Load prompt: Sample Prompt' }));

      const menuItem = screen.getByText('Open in new tab').closest('[role=\"menuitem\"]');
      expect(menuItem).toHaveAttribute('data-disabled');
      expect(onOpenInNewTab).not.toHaveBeenCalled();
    });

    it('invokes duplicate from the context menu', async () => {
      const onDuplicate = vi.fn();
      const user = userEvent.setup();

      render(
        <HistoryItem
          {...baseProps}
          onDuplicate={onDuplicate}
        />
      );

      fireEvent.contextMenu(screen.getByRole('button', { name: 'Load prompt: Sample Prompt' }));

      await user.click(screen.getByText('Duplicate'));

      expect(onDuplicate).toHaveBeenCalledWith(baseProps.entry);
    });
  });

  describe('core behavior', () => {
    it('loads the entry when the row button is clicked', async () => {
      const onLoad = vi.fn();
      const user = userEvent.setup();

      render(
        <HistoryItem
          {...baseProps}
          onLoad={onLoad}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Load prompt: Sample Prompt' }));

      expect(onLoad).toHaveBeenCalledWith(baseProps.entry);
    });
  });
});
