/**
 * Span Worker Hook
 *
 * React hook for using the Span Processing Web Worker.
 * Provides a simple interface for offloading span processing to a background thread.
 *
 * USAGE:
 * ```ts
 * const { processSpans, isProcessing } = useSpanWorker();
 *
 * const result = await processSpans(spans, text, {
 *   minConfidence: 0.7,
 *   maxSpans: 50,
 *   removeOverlaps: true,
 * });
 * ```
 *
 * BENEFITS:
 * - Non-blocking span processing
 * - Keeps UI responsive with heavy computations
 * - Automatic worker lifecycle management
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import type {
  Span,
  ProcessingOptions,
  ProcessedResult,
  WorkerCallback,
  WorkerMessage,
} from './types';

/**
 * Hook for span processing via Web Worker
 */
export function useSpanWorker(): {
  processSpans: (
    spans: Span[],
    text: string,
    options?: ProcessingOptions
  ) => Promise<ProcessedResult>;
  isProcessing: boolean;
  isWorkerAvailable: boolean;
} {
  const workerRef = useRef<Worker | null>(null);
  const isProcessingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const callbacksRef = useRef(new Map<number, WorkerCallback>()); // Track pending callbacks for cleanup
  const messageIdRef = useRef(0); // Unique ID for each message

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker from the worker file
      workerRef.current = new Worker(
        new URL('../workers/spanProcessor.worker.js', import.meta.url),
        { type: 'module' }
      );

      // Handle worker errors
      workerRef.current.onerror = (error: ErrorEvent) => {
        console.error('[SpanWorker] Worker error:', error);
        isProcessingRef.current = false;
        setIsProcessing(false);

        // Reject all pending callbacks
        callbacksRef.current.forEach((callback) => {
          callback.reject(new Error('Worker crashed'));
        });
        callbacksRef.current.clear();
      };

      // Handle messages from worker
      workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === 'ready') {
          console.log('[SpanWorker] Worker initialized and ready');
          return;
        }

        const { id, type } = e.data;
        const callback = callbacksRef.current.get(id);

        if (!callback) return;

        // Clear timeout for this callback
        if (callback.timeoutId) {
          clearTimeout(callback.timeoutId);
        }

        isProcessingRef.current = false;
        setIsProcessing(false);

        if (type === 'result') {
          callback.resolve({
            processedSpans: e.data.processedSpans || [],
            meta: {
              ...e.data.meta,
              usedWorker: true,
            },
          } as ProcessedResult);
        } else if (type === 'error') {
          callback.reject(new Error(e.data.error || 'Worker error'));
        } else {
          callback.reject(new Error(`Unknown worker response type: ${type}`));
        }

        // Remove callback from map
        callbacksRef.current.delete(id);
      };
    } catch (error) {
      console.warn('[SpanWorker] Failed to initialize worker:', error);
      workerRef.current = null;
    }

    // CRITICAL: Cleanup worker on unmount and reject pending callbacks
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      // Reject any pending callbacks
      callbacksRef.current.forEach((callback) => {
        if (callback.timeoutId) {
          clearTimeout(callback.timeoutId);
        }
        callback.reject(new Error('Component unmounted'));
      });
      callbacksRef.current.clear();
    };
  }, []);

  /**
   * Process spans using the Web Worker
   */
  const processSpans = useCallback(
    async (
      spans: Span[],
      text: string,
      options: ProcessingOptions = {}
    ): Promise<ProcessedResult> => {
      // Fallback to synchronous processing if worker not available
      if (!workerRef.current) {
        console.warn(
          '[SpanWorker] Worker not available, using synchronous processing'
        );
        return {
          processedSpans: spans,
          meta: {
            originalCount: spans.length,
            processedCount: spans.length,
            processingTime: 0,
            usedWorker: false,
          },
        };
      }

      isProcessingRef.current = true;
      setIsProcessing(true);

      return new Promise<ProcessedResult>((resolve, reject) => {
        // Generate unique ID for this request
        const id = ++messageIdRef.current;

        // Set up timeout that will clean up the callback
        const timeoutId = setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessing(false);
          callbacksRef.current.delete(id);
          reject(new Error('Worker processing timeout'));
        }, 5000); // 5 second timeout

        // Store callback with timeout ID for cleanup
        callbacksRef.current.set(id, { resolve, reject, timeoutId });

        // Send processing request to worker with unique ID
        workerRef.current?.postMessage({
          id,
          type: 'process',
          spans,
          text,
          options,
        } as WorkerMessage);
      });
    },
    []
  );

  return {
    processSpans,
    isProcessing,
    isWorkerAvailable: workerRef.current !== null,
  };
}

