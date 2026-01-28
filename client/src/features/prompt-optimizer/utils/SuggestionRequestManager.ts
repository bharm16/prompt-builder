/**
 * SuggestionRequestManager - Manages request lifecycle for AI suggestions.
 * Handles cancellation, debouncing, and deduplication of suggestion requests.
 *
 * @module SuggestionRequestManager
 */

import { CancellationError } from './signalUtils';

/**
 * Configuration for the request manager.
 */
export interface RequestManagerConfig {
  /** Debounce delay in milliseconds. Default: 150 */
  debounceMs: number;
  /** Request timeout in milliseconds. Default: 3000 */
  timeoutMs: number;
}

/**
 * Internal state for tracking request lifecycle.
 */
interface RequestState {
  /** Key for deduplication (e.g., highlighted text) */
  currentDedupKey: string | null;
  /** Controller for aborting in-flight requests */
  abortController: AbortController | null;
  /** Timer for debouncing */
  debounceTimer: ReturnType<typeof setTimeout> | null;
  /** Reject function for the current pending promise (to reject on cancel during debounce) */
  pendingReject: ((error: Error) => void) | null;
}

const DEFAULT_CONFIG: RequestManagerConfig = {
  debounceMs: 150,
  timeoutMs: 3000,
};

/**
 * Manages the lifecycle of suggestion requests with support for:
 * - Request cancellation (abort in-flight requests)
 * - Trailing-edge debouncing (wait for user to stop selecting)
 * - Deduplication (prevent duplicate requests for same text)
 *
 * @example
 * ```typescript
 * const manager = new SuggestionRequestManager({ debounceMs: 150 });
 *
 * // Schedule a debounced request
 * const result = await manager.scheduleRequest(
 *   'highlighted text',
 *   async (signal) => {
 *     return fetch('/api/suggestions', { signal });
 *   }
 * );
 *
 * // Cleanup on unmount
 * manager.dispose();
 * ```
 */
export class SuggestionRequestManager {
  private state: RequestState;
  private config: RequestManagerConfig;

  constructor(config?: Partial<RequestManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      currentDedupKey: null,
      abortController: null,
      debounceTimer: null,
      pendingReject: null,
    };
  }

  /**
   * Cancel any in-flight request AND clear pending debounce timer.
   * Safe to call multiple times.
   */
  cancelCurrentRequest(): void {
    // Clear debounce timer first
    if (this.state.debounceTimer !== null) {
      clearTimeout(this.state.debounceTimer);
      this.state.debounceTimer = null;
    }

    // Reject any pending promise that's waiting for debounce
    if (this.state.pendingReject !== null) {
      this.state.pendingReject(new CancellationError('Request cancelled during debounce'));
      this.state.pendingReject = null;
    }

    // Abort any in-flight request
    if (this.state.abortController !== null) {
      this.state.abortController.abort();
      this.state.abortController = null;
    }

    // Clear dedup key
    this.state.currentDedupKey = null;
  }

  /**
   * Schedule a new request with trailing-edge debouncing.
   *
   * @param dedupKey - Key for deduplication (e.g., highlighted text)
   * @param requestFn - Function that performs the actual fetch
   * @returns Promise that resolves with the request result
   * @throws CancellationError if request is cancelled
   * @throws Error for network/timeout errors
   */
  scheduleRequest<T>(dedupKey: string, requestFn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Cancel any previous pending request
      this.cancelCurrentRequest();

      // Set the dedup key immediately to prevent duplicate scheduling
      this.state.currentDedupKey = dedupKey;

      // Create new abort controller for this request
      const abortController = new AbortController();
      this.state.abortController = abortController;

      // Store reject function so we can reject if cancelled during debounce
      this.state.pendingReject = reject;

      // Schedule the request after debounce delay (trailing-edge)
      this.state.debounceTimer = setTimeout(async () => {
        this.state.debounceTimer = null;
        // Clear pendingReject since we're now executing
        this.state.pendingReject = null;

        // Check if this request was cancelled during debounce
        if (abortController.signal.aborted) {
          reject(new CancellationError('Request cancelled during debounce'));
          return;
        }

        try {
          // Execute the request with the abort signal
          const result = await requestFn(abortController.signal);

          // Check if cancelled after request completed
          if (abortController.signal.aborted) {
            reject(new CancellationError('Request cancelled after completion'));
            return;
          }

          // Clear state on success
          this.clearRequestState(dedupKey);
          resolve(result);
        } catch (error) {
          // Clear state on error
          this.clearRequestState(dedupKey);

          // Convert AbortError to CancellationError
          if (error instanceof Error && error.name === 'AbortError') {
            reject(new CancellationError('Request aborted'));
            return;
          }

          reject(error);
        }
      }, this.config.debounceMs);
    });
  }

  /**
   * Check if a request with this dedup key is currently in-flight.
   *
   * @param dedupKey - Key to check
   * @returns True if a request with this key is in-flight
   */
  isRequestInFlight(dedupKey: string): boolean {
    return this.state.currentDedupKey === dedupKey && this.state.abortController !== null;
  }

  /**
   * Cleanup on unmount - cancels everything.
   */
  dispose(): void {
    this.cancelCurrentRequest();
  }

  /**
   * Clear request state if the dedup key matches.
   * This prevents clearing state for a newer request.
   */
  private clearRequestState(dedupKey: string): void {
    if (this.state.currentDedupKey === dedupKey) {
      this.state.currentDedupKey = null;
      this.state.abortController = null;
    }
  }

  /**
   * Get current configuration (for testing/debugging).
   */
  getConfig(): Readonly<RequestManagerConfig> {
    return { ...this.config };
  }
}
