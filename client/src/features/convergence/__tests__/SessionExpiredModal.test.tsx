import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SessionExpiredModal } from '../components/modals/SessionExpiredModal';

// ============================================================================
// SessionExpiredModal
// ============================================================================

describe('SessionExpiredModal', () => {
  describe('error handling', () => {
    it('renders nothing when the modal is closed', () => {
      render(
        <SessionExpiredModal
          onStartNew={vi.fn()}
          isOpen={false}
        />
      );

      expect(screen.queryByText('Session Expired')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('omits the previous intent block when intent is missing', () => {
      render(
        <SessionExpiredModal
          onStartNew={vi.fn()}
          isOpen
        />
      );

      expect(screen.queryByText('Your previous intent')).toBeNull();
    });

    it('shows the previous intent when provided', () => {
      render(
        <SessionExpiredModal
          onStartNew={vi.fn()}
          isOpen
          intent="A misty forest at sunrise"
        />
      );

      expect(screen.getByText('Your previous intent')).toBeInTheDocument();
      expect(screen.getByText('"A misty forest at sunrise"')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('calls onStartNew when the action button is clicked', async () => {
      const onStartNew = vi.fn();
      const user = userEvent.setup();

      render(
        <SessionExpiredModal
          onStartNew={onStartNew}
          isOpen
        />
      );

      await user.click(screen.getByRole('button', { name: 'Start New Session' }));

      expect(onStartNew).toHaveBeenCalledTimes(1);
    });
  });
});
