/**
 * Unit tests for PanelHeader
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import { PanelHeader } from '@components/SuggestionsPanel/components/PanelHeader';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const DummyIcon = () => <svg data-testid="icon" />;

describe('PanelHeader', () => {
  describe('edge cases', () => {
    it('renders no context section when inactive', () => {
      render(<PanelHeader panelTitle="Panel" hasActiveSuggestions={false} contextValue="" />);

      expect(screen.queryByText(/Editing:/i)).not.toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes refresh and close handlers', () => {
      const onRefresh = vi.fn();
      const onClose = vi.fn();

      render(
        <PanelHeader
          panelTitle="Panel"
          onRefresh={onRefresh}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByLabelText('Refresh suggestions'));
      fireEvent.click(screen.getByLabelText('Close suggestions'));

      expect(onRefresh).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('renders context details and badge when active', () => {
      render(
        <PanelHeader
          panelTitle="Panel"
          hasActiveSuggestions
          contextValue="Selected text"
          contextSecondaryValue="tone"
          showContextBadge
          contextBadgeText="Context-aware"
          contextIcon={DummyIcon}
          contextBadgeIcon={DummyIcon}
        />
      );

      expect(screen.getByText('Editing:')).toBeInTheDocument();
      expect(screen.getByText('"Selected text"')).toBeInTheDocument();
      expect(screen.getByText('Category:')).toBeInTheDocument();
      expect(screen.getByText('tone')).toBeInTheDocument();
      expect(screen.getByText('Context-aware')).toBeInTheDocument();
    });
  });
});
