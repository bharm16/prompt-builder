import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';

import { NetworkStatusBanner } from '../components/shared/NetworkStatusBanner';
import type { NetworkStatus } from '../types';

// ============================================================================
// NetworkStatusBanner
// ============================================================================

describe('NetworkStatusBanner', () => {
  const onlineStatus: NetworkStatus = {
    isOnline: true,
    wasOffline: false,
    offlineSince: null,
    restoredAt: null,
  };

  const offlineStatus: NetworkStatus = {
    isOnline: false,
    wasOffline: false,
    offlineSince: new Date('2024-01-01T00:00:00Z'),
    restoredAt: null,
  };

  describe('error handling', () => {
    it('shows the offline banner when the user is disconnected', () => {
      render(
        <NetworkStatusBanner
          status={offlineStatus}
        />
      );

      expect(screen.getByText("You're offline")).toBeInTheDocument();
      expect(screen.queryByText("You're back online")).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('auto-dismisses the recovery banner after 10 seconds', () => {
      vi.useFakeTimers();

      const onDismiss = vi.fn();
      render(
        <NetworkStatusBanner
          status={{ ...onlineStatus, wasOffline: true, restoredAt: new Date('2024-01-01T00:00:00Z') }}
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByText("You're back online")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("You're back online")).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('core behavior', () => {
    it('invokes retry and dismiss handlers in the recovery banner', async () => {
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      const user = userEvent.setup();

      render(
        <NetworkStatusBanner
          status={{ ...onlineStatus, wasOffline: true, restoredAt: new Date('2024-01-01T00:00:00Z') }}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Retry last operation' }));
      await user.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
