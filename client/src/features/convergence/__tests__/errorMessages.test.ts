import { describe, it, expect, vi } from 'vitest';

import {
  getErrorMessage,
  getErrorMessageString,
  isRetryableError,
  getNetworkErrorMessage,
  isSessionExpired,
  getSessionTimeRemaining,
  formatTimeRemaining,
  SESSION_TTL_MS,
} from '../utils/errorMessages';

// ============================================================================
// errorMessages
// ============================================================================

describe('errorMessages utilities', () => {
  describe('error handling', () => {
    it('treats sessions older than the TTL as expired', () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-02T00:00:00Z');
      vi.setSystemTime(now);

      const expiredAt = new Date(now.getTime() - SESSION_TTL_MS - 1000);

      expect(isSessionExpired(expiredAt)).toBe(true);
      expect(getSessionTimeRemaining(expiredAt)).toBe(0);

      vi.useRealTimers();
    });

    it('formats expired durations as expired', () => {
      expect(formatTimeRemaining(0)).toBe('expired');
      expect(formatTimeRemaining(-100)).toBe('expired');
    });
  });

  describe('edge cases', () => {
    it('formats remaining time in hours when above one hour', () => {
      const remaining = 3 * 60 * 60 * 1000 + 5 * 60 * 1000;
      expect(formatTimeRemaining(remaining)).toBe('3 hours');
    });

    it('formats remaining time in minutes when below one hour', () => {
      const remaining = 25 * 60 * 1000;
      expect(formatTimeRemaining(remaining)).toBe('25 minutes');
    });
  });

  describe('core behavior', () => {
    it('returns configured error messages and retryability', () => {
      const config = getErrorMessage('IMAGE_GENERATION_FAILED');
      expect(config.message).toBe('We encountered an issue while generating your images.');
      expect(isRetryableError('IMAGE_GENERATION_FAILED')).toBe(true);
      expect(isRetryableError('INSUFFICIENT_CREDITS')).toBe(false);
      expect(getErrorMessageString('SESSION_EXPIRED')).toBe('Your session has expired after 24 hours of inactivity.');
    });

    it('returns network-specific error messages', () => {
      const config = getNetworkErrorMessage('SERVER_ERROR');
      expect(config.title).toBe('Server Error');
      expect(config.isRetryable).toBe(true);
    });
  });
});
