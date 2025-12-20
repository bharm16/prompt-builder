/**
 * Express Request Type Augmentation
 *
 * Extends the Express Request interface with custom properties
 * added by middleware (requestId and performanceMonitor).
 */
import 'express';

/**
 * Performance metrics returned by getMetrics()
 */
interface PerfMetrics {
  total: number;
  operations: Record<string, number>;
  metadata: Record<string, unknown>;
}

/**
 * Performance monitor interface attached to requests
 * by the PerformanceMonitor middleware
 */
interface RequestPerfMonitor {
  /**
   * Start timing for a specific operation
   * @param operationName - Name of the operation to track
   */
  start: (operationName: string) => void;

  /**
   * End timing and record duration for an operation
   * @param operationName - Name of the operation to complete
   */
  end: (operationName: string) => void;

  /**
   * Add metadata to the request performance context
   * @param key - Metadata key
   * @param value - Metadata value
   */
  addMetadata: (key: string, value: unknown) => void;

  /**
   * Get current performance metrics
   * @returns Current metrics including total time, operations, and metadata
   */
  getMetrics: () => PerfMetrics;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique request identifier
       * Set by requestId middleware from X-Request-ID header or generated UUID
       */
      id: string;

      /**
       * Performance monitoring context
       * Set by PerformanceMonitor middleware for tracking request timing
       */
      perfMonitor?: RequestPerfMonitor;
    }
  }
}

export {};
