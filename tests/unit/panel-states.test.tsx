/**
 * Unit tests for PanelStates components
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import { LoadingState, EmptyState, ErrorState, InactiveState } from '@components/SuggestionsPanel/components/PanelStates';
import { getLoadingSkeletonCount } from '@components/SuggestionsPanel/utils/suggestionHelpers';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const DummyIcon = () => <svg data-testid="icon" />;

describe('PanelStates', () => {
  describe('LoadingState', () => {
    it('renders placeholder messaging for placeholder suggestions', () => {
      const { container } = render(
        <LoadingState contextValue="short" isPlaceholder />
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(getLoadingSkeletonCount(5, true));
      expect(screen.getByText('Finding relevant values...')).toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    it('renders configured title and description', () => {
      render(
        <EmptyState
          emptyState={{
            title: 'No suggestions',
            description: 'Try selecting text.',
            icon: DummyIcon,
          }}
        />
      );

      expect(screen.getByText('No suggestions')).toBeInTheDocument();
      expect(screen.getByText('Try selecting text.')).toBeInTheDocument();
    });
  });

  describe('ErrorState', () => {
    it('renders error message and triggers retry', () => {
      const onRetry = vi.fn();

      render(
        <ErrorState
          errorState={{
            title: 'Error',
            description: 'Default message',
            icon: DummyIcon,
          }}
          errorMessage="Custom message"
          onRetry={onRetry}
        />
      );

      expect(screen.getByText('Custom message')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Retry'));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('InactiveState', () => {
    it('renders example and tips when provided', () => {
      render(
        <InactiveState
          inactiveState={{
            title: 'Select text',
            description: 'Highlight text to start.',
            icon: DummyIcon,
            example: {
              from: 'Old',
              to: ['New A', 'New B'],
            },
            tips: [{ text: 'Try shorter selections.' }],
          }}
        />
      );

      expect(screen.getByText('Select text')).toBeInTheDocument();
      expect(screen.getByText('Old → New A | New B')).toBeInTheDocument();
      expect(screen.getByText('Try shorter selections.')).toBeInTheDocument();
    });
  });
});
