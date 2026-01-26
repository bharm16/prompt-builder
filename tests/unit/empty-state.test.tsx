import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import EmptyState, {
  SearchEmptyState,
  ErrorEmptyState,
  LoadingEmptyState,
} from '@/components/EmptyState';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('EmptyState', () => {
  describe('error handling', () => {
    it('renders error variant copy and retry action', () => {
      const onRetry = vi.fn();
      render(<ErrorEmptyState onRetry={onRetry} errorMessage="Failed to load" />);

      expect(screen.getByText('Failed to load')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onRetry).toHaveBeenCalled();
    });

    it('uses default error messaging when none is provided', () => {
      render(<EmptyState variant="error" />);

      expect(screen.getByText("We couldn't load your data")).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('omits the tips section when tips are empty', () => {
      render(<EmptyState variant="loading" tips={[]} />);

      expect(screen.queryByText('Tips to get started:')).toBeNull();
    });

    it('customizes search description with query and clear action', () => {
      const onClear = vi.fn();
      render(<SearchEmptyState searchQuery="cats" onClearSearch={onClear} />);

      expect(screen.getByText('No results found for "cats"')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('renders a custom action button', () => {
      const onClick = vi.fn();
      render(
        <EmptyState
          variant="welcome"
          title="Custom title"
          description="Custom description"
          action={{ label: 'Start now', onClick }}
        />
      );

      expect(screen.getByText('Custom title')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Start now' }));
      expect(onClick).toHaveBeenCalled();
    });
  });
});
