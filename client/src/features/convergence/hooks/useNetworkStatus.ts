/**
 * useNetworkStatus Hook
 *
 * Detects network connectivity status and provides recovery prompts.
 * Uses navigator.onLine and online/offline events for detection.
 *
 * @requirement 11.8 - Recover session on reconnect
 * @task 37.3 - Add network disconnect detection and recovery prompt
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface NetworkStatus {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether the connection was recently restored */
  wasOffline: boolean;
  /** Timestamp of when the connection was lost (if offline) */
  offlineSince: Date | null;
  /** Timestamp of when the connection was restored (if recently restored) */
  restoredAt: Date | null;
}

export interface UseNetworkStatusReturn {
  /** Current network status */
  status: NetworkStatus;
  /** Clear the "was offline" flag after handling recovery */
  clearRecoveryFlag: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useNetworkStatus - Monitors network connectivity
 *
 * @returns Network status and recovery utilities
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { status, clearRecoveryFlag } = useNetworkStatus();
 *
 *   useEffect(() => {
 *     if (status.wasOffline && status.isOnline) {
 *       // Connection restored - retry pending operations
 *       retryPendingOperations();
 *       clearRecoveryFlag();
 *     }
 *   }, [status.wasOffline, status.isOnline]);
 *
 *   if (!status.isOnline) {
 *     return <OfflineMessage />;
 *   }
 *
 *   return <MainContent />;
 * }
 * ```
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    offlineSince: null,
    restoredAt: null,
  }));

  // Handle going offline
  const handleOffline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      isOnline: false,
      offlineSince: new Date(),
    }));
  }, []);

  // Handle coming back online
  const handleOnline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      isOnline: true,
      wasOffline: prev.offlineSince !== null, // Only set if we were actually offline
      restoredAt: new Date(),
      offlineSince: null,
    }));
  }, []);

  // Clear the recovery flag after handling
  const clearRecoveryFlag = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      wasOffline: false,
      restoredAt: null,
    }));
  }, []);

  // Set up event listeners
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    status,
    clearRecoveryFlag,
  };
}

export default useNetworkStatus;
