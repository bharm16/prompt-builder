import { logger } from '../infrastructure/Logger.js';
import { metricsService } from '../infrastructure/MetricsService.js';

/**
 * ConcurrencyLimiter - Manages concurrent API request limits with priority queue
 *
 * Prevents exceeding OpenAI's rate limits by enforcing a maximum number of
 * concurrent requests. When the limit is reached, new requests are queued
 * and processed when slots become available.
 *
 * Features:
 * - Priority queue (newer requests can cancel older ones)
 * - Request timeout handling
 * - Automatic queue cleanup
 * - Metrics tracking
 *
 * @example
 * const limiter = new ConcurrencyLimiter({ maxConcurrent: 5 });
 * const result = await limiter.execute(async () => {
 *   return await apiClient.call();
 * });
 */
export class ConcurrencyLimiter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.maxConcurrent - Maximum concurrent requests (default: 5)
   * @param {number} options.queueTimeout - Max time in queue before rejection (default: 30000ms)
   * @param {boolean} options.enableCancellation - Enable request cancellation (default: true)
   */
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.queueTimeout = options.queueTimeout || 30000; // 30 seconds
    this.enableCancellation = options.enableCancellation !== false;

    // Track active requests
    this.activeCount = 0;

    // Priority queue: [{ fn, resolve, reject, timestamp, id }]
    this.queue = [];

    // Track request IDs for cancellation
    this.nextRequestId = 0;

    // Metrics
    this.stats = {
      totalExecuted: 0,
      totalQueued: 0,
      totalCancelled: 0,
      totalTimedOut: 0,
      maxQueueLength: 0,
      avgQueueTime: 0,
      queueTimes: [],
    };

    logger.debug('ConcurrencyLimiter initialized', {
      maxConcurrent: this.maxConcurrent,
      queueTimeout: this.queueTimeout,
      enableCancellation: this.enableCancellation,
    });
  }

  /**
   * Execute a function with concurrency limiting
   *
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Execution options
   * @param {AbortSignal} options.signal - Optional abort signal for cancellation
   * @param {boolean} options.priority - If true, cancels oldest queued request
   * @returns {Promise} Result of the function execution
   */
  async execute(fn, options = {}) {
    const requestId = this.nextRequestId++;
    const startTime = Date.now();

    // Check if we can execute immediately
    if (this.activeCount < this.maxConcurrent) {
      return await this._executeImmediately(fn, requestId);
    }

    // Queue the request
    return await this._queueRequest(fn, requestId, startTime, options);
  }

  /**
   * Execute immediately without queueing
   * @private
   */
  async _executeImmediately(fn, requestId) {
    this.activeCount++;
    this.stats.totalExecuted++;

    logger.debug('Executing request immediately', {
      requestId,
      activeCount: this.activeCount,
      queueLength: this.queue.length,
    });

    try {
      const result = await fn();
      return result;
    } finally {
      this.activeCount--;
      this._processQueue();
    }
  }

  /**
   * Queue a request for later execution
   * @private
   */
  async _queueRequest(fn, requestId, startTime, options) {
    return new Promise((resolve, reject) => {
      // Handle priority requests (cancel oldest if enabled)
      if (options.priority && this.enableCancellation && this.queue.length > 0) {
        const oldestRequest = this.queue.shift();
        // Clear timeout before rejecting to prevent memory leak
        if (oldestRequest.timeoutId) {
          clearTimeout(oldestRequest.timeoutId);
        }
        oldestRequest.reject(new Error('Request cancelled by higher priority request'));
        this.stats.totalCancelled++;

        logger.debug('Cancelled oldest request for priority', {
          cancelledId: oldestRequest.id,
          newRequestId: requestId,
        });
      }

      // Add to queue
      const queueItem = {
        id: requestId,
        fn,
        resolve,
        reject,
        timestamp: startTime,
        timeoutId: null,
      };

      // Set timeout for queue expiration
      queueItem.timeoutId = setTimeout(() => {
        this._handleTimeout(queueItem);
      }, this.queueTimeout);

      // Handle abort signal if provided
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          this._cancelRequest(queueItem);
        });
      }

      this.queue.push(queueItem);
      this.stats.totalQueued++;
      this.stats.maxQueueLength = Math.max(this.stats.maxQueueLength, this.queue.length);

      logger.debug('Request queued', {
        requestId,
        queueLength: this.queue.length,
        activeCount: this.activeCount,
      });

      // Record queue metric
      metricsService.recordGauge('request_queue_length', this.queue.length);
    });
  }

  /**
   * Process the next item in the queue
   * @private
   */
  _processQueue() {
    if (this.queue.length === 0 || this.activeCount >= this.maxConcurrent) {
      return;
    }

    const queueItem = this.queue.shift();

    // Clear the timeout
    if (queueItem.timeoutId) {
      clearTimeout(queueItem.timeoutId);
    }

    // Calculate queue time
    const queueTime = Date.now() - queueItem.timestamp;
    this.stats.queueTimes.push(queueTime);

    // Keep only last 100 queue times for average calculation
    if (this.stats.queueTimes.length > 100) {
      this.stats.queueTimes.shift();
    }

    this.stats.avgQueueTime =
      this.stats.queueTimes.reduce((a, b) => a + b, 0) / this.stats.queueTimes.length;

    logger.debug('Processing queued request', {
      requestId: queueItem.id,
      queueTime,
      remainingQueue: this.queue.length,
    });

    // Execute the queued function
    this.activeCount++;
    this.stats.totalExecuted++;

    queueItem.fn()
      .then(result => {
        queueItem.resolve(result);
      })
      .catch(error => {
        queueItem.reject(error);
      })
      .finally(() => {
        this.activeCount--;
        this._processQueue();
      });

    // Record metrics
    metricsService.recordGauge('request_queue_length', this.queue.length);
    metricsService.recordHistogram('request_queue_time_ms', queueTime);
  }

  /**
   * Handle request timeout
   * @private
   */
  _handleTimeout(queueItem) {
    const index = this.queue.indexOf(queueItem);
    if (index === -1) {
      return; // Already processed
    }

    // Remove from queue
    this.queue.splice(index, 1);
    this.stats.totalTimedOut++;

    const error = new Error(
      `Request timed out after ${this.queueTimeout}ms in queue`
    );
    error.code = 'QUEUE_TIMEOUT';

    queueItem.reject(error);

    logger.warn('Request timed out in queue', {
      requestId: queueItem.id,
      queueTime: Date.now() - queueItem.timestamp,
      queueLength: this.queue.length,
    });

    metricsService.recordGauge('request_queue_length', this.queue.length);
  }

  /**
   * Cancel a specific request
   * @private
   */
  _cancelRequest(queueItem) {
    const index = this.queue.indexOf(queueItem);
    if (index === -1) {
      return; // Already processed
    }

    // Remove from queue
    this.queue.splice(index, 1);
    this.stats.totalCancelled++;

    // Clear timeout
    if (queueItem.timeoutId) {
      clearTimeout(queueItem.timeoutId);
    }

    const error = new Error('Request cancelled');
    error.code = 'CANCELLED';

    queueItem.reject(error);

    logger.debug('Request cancelled', {
      requestId: queueItem.id,
      queueLength: this.queue.length,
    });

    metricsService.recordGauge('request_queue_length', this.queue.length);
  }

  /**
   * Get current statistics
   * @returns {Object} Current limiter statistics
   */
  getStats() {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      ...this.stats,
    };
  }

  /**
   * Clear the queue and reject all pending requests
   */
  clearQueue() {
    const count = this.queue.length;

    while (this.queue.length > 0) {
      const queueItem = this.queue.shift();

      if (queueItem.timeoutId) {
        clearTimeout(queueItem.timeoutId);
      }

      queueItem.reject(new Error('Queue cleared'));
    }

    logger.info('Queue cleared', { clearedCount: count });
    metricsService.recordGauge('request_queue_length', 0);
  }

  /**
   * Get queue status for debugging
   * @returns {Object} Queue status information
   */
  getQueueStatus() {
    return {
      activeRequests: this.activeCount,
      queuedRequests: this.queue.length,
      availableSlots: this.maxConcurrent - this.activeCount,
      oldestQueuedRequest: this.queue.length > 0
        ? Date.now() - this.queue[0].timestamp
        : null,
    };
  }
}

// Singleton instance for OpenAI API limiting
export const openAILimiter = new ConcurrencyLimiter({
  maxConcurrent: 5,
  queueTimeout: 30000,
  enableCancellation: true,
});
