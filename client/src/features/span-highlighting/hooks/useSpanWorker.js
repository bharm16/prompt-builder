/**
 * Span Worker Hook
 * 
 * React hook for using the Span Processing Web Worker.
 * Provides a simple interface for offloading span processing to a background thread.
 * 
 * USAGE:
 * ```js
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

import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook for span processing via Web Worker
 * 
 * @returns {Object} Worker interface
 */
export function useSpanWorker() {
  const workerRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker from the worker file
      workerRef.current = new Worker(
        new URL('../workers/spanProcessor.worker.js', import.meta.url),
        { type: 'module' }
      );

      // Handle worker errors
      workerRef.current.onerror = (error) => {
        console.error('[SpanWorker] Worker error:', error);
        isProcessingRef.current = false;
      };

      // Log when worker is ready
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'ready') {
          console.log('[SpanWorker] Worker initialized and ready');
        }
      };
    } catch (error) {
      console.warn('[SpanWorker] Failed to initialize worker:', error);
      workerRef.current = null;
    }

    // Cleanup worker on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * Process spans using the Web Worker
   * 
   * @param {Array} spans - Spans to process
   * @param {string} text - Source text
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed result
   */
  const processSpans = useCallback(async (spans, text, options = {}) => {
    // Fallback to synchronous processing if worker not available
    if (!workerRef.current) {
      console.warn('[SpanWorker] Worker not available, using synchronous processing');
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

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        isProcessingRef.current = false;
        reject(new Error('Worker processing timeout'));
      }, 5000); // 5 second timeout

      workerRef.current.onmessage = (e) => {
        clearTimeout(timeoutId);
        isProcessingRef.current = false;

        if (e.data.type === 'result') {
          resolve({
            processedSpans: e.data.processedSpans,
            meta: {
              ...e.data.meta,
              usedWorker: true,
            },
          });
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        } else if (e.data.type !== 'ready') {
          // Ignore 'ready' messages, reject unknown types
          reject(new Error(`Unknown worker response type: ${e.data.type}`));
        }
      };

      // Send processing request to worker
      workerRef.current.postMessage({
        type: 'process',
        spans,
        text,
        options,
      });
    });
  }, []);

  return {
    processSpans,
    isProcessing: isProcessingRef.current,
    isWorkerAvailable: workerRef.current !== null,
  };
}

