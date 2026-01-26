import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useNetworkStatus } from '../hooks/useNetworkStatus';

const setNavigatorOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
};

// ============================================================================
// useNetworkStatus
// ============================================================================

describe('useNetworkStatus', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', originalDescriptor);
    }
  });

  describe('error handling', () => {
    it('marks the session as offline when the offline event fires', () => {
      const { result } = renderHook(() => useNetworkStatus());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.status.isOnline).toBe(false);
      expect(result.current.status.offlineSince).toBeInstanceOf(Date);
    });

    it('marks recovery when the connection is restored', () => {
      const { result } = renderHook(() => useNetworkStatus());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.status.isOnline).toBe(true);
      expect(result.current.status.wasOffline).toBe(true);
      expect(result.current.status.restoredAt).toBeInstanceOf(Date);
      expect(result.current.status.offlineSince).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('clears the recovery flag after acknowledgement', () => {
      const { result } = renderHook(() => useNetworkStatus());

      act(() => {
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));
      });

      act(() => {
        result.current.clearRecoveryFlag();
      });

      expect(result.current.status.wasOffline).toBe(false);
      expect(result.current.status.restoredAt).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('initializes state from navigator.onLine', () => {
      setNavigatorOnline(false);
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.status.isOnline).toBe(false);
    });
  });
});
