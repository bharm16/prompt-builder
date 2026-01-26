/**
 * Unit tests for QuickActions
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import QuickActions from '@components/QuickActions';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const DummyIcon = () => <svg data-testid="icon" />;

describe('QuickActions', () => {
  describe('edge cases', () => {
    it('falls back to creative category when none is provided', () => {
      render(
        <QuickActions
          actions={[{ label: 'Surprise', icon: DummyIcon }]}
          onActionClick={vi.fn()}
        />
      );

      expect(screen.getByText('Creative')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes onActionClick with the selected action', () => {
      const onActionClick = vi.fn();
      const action = {
        label: 'Deep Research',
        description: 'Gather sources',
        category: 'research' as const,
        icon: DummyIcon,
      };

      render(<QuickActions actions={[action]} onActionClick={onActionClick} />);

      fireEvent.click(screen.getByRole('button', { name: /Use Deep Research template/i }));

      expect(onActionClick).toHaveBeenCalledWith(action);
      expect(screen.getByText('Gather sources')).toBeInTheDocument();
    });
  });
});
