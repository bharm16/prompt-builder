import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErrorDisplay } from '../components/shared/ErrorDisplay';

// ============================================================================
// ErrorDisplay
// ============================================================================

describe('ErrorDisplay', () => {
  describe('error handling', () => {
    it('shows a retry action for retryable error codes', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();

      render(
        <ErrorDisplay
          error="Generation failed"
          errorCode="IMAGE_GENERATION_FAILED"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: 'Retry operation' });
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('hides retry when the error indicates a limit without an error code', () => {
      render(
        <ErrorDisplay
          error="Daily limit reached"
          onRetry={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: 'Retry operation' })).toBeNull();
    });

    it('disables the retry button while retrying', () => {
      render(
        <ErrorDisplay
          error="Temporary issue"
          errorCode="VIDEO_GENERATION_FAILED"
          onRetry={vi.fn()}
          isRetrying
        />
      );

      const retryButton = screen.getByRole('button', { name: 'Retrying...' });
      expect(retryButton).toBeDisabled();
      expect(screen.getByText('Retrying...')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders titles and suggested actions from error configs', () => {
      render(
        <ErrorDisplay
          error="Session expired"
          errorCode="SESSION_EXPIRED"
        />
      );

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(screen.getByText('Your session has expired after 24 hours of inactivity.')).toBeInTheDocument();
      expect(screen.getByText('Please start a new creative session to continue.')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes onDismiss when the dismiss button is clicked', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();

      render(
        <ErrorDisplay
          error="Something broke"
          onDismiss={onDismiss}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Dismiss error' }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
