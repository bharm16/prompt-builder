import type { EnhancementMetrics } from '../services/types.js';
import type { EnhancementMetricsService } from '../services/EnhancementMetricsService.js';

export interface MetricsContext {
  highlightedCategory: string | null;
  isVideoPrompt: boolean;
  modelTarget: string | null;
  promptSection: string | null;
}

/**
 * Metrics Decorator
 *
 * Wraps async functions with automatic metrics tracking.
 * Reduces metrics logging pollution in business logic.
 */
export class MetricsDecorator {
  /**
   * Wrap an async function with metrics tracking
   *
   * @param fn - Function to wrap
   * @param metricsLogger - Metrics service for logging
   * @param context - Context for metrics logging
   * @param initialMetrics - Initial metrics object (will be mutated)
   * @returns Wrapped function result
   */
  static async withMetrics<T>(
    fn: (metrics: EnhancementMetrics) => Promise<T>,
    metricsLogger: EnhancementMetricsService,
    context: MetricsContext,
    initialMetrics: EnhancementMetrics
  ): Promise<T> {
    const startTotal = Date.now();
    initialMetrics.total = 0;

    try {
      const result = await fn(initialMetrics);
      initialMetrics.total = Date.now() - startTotal;
      metricsLogger.logMetrics(initialMetrics, context);
      metricsLogger.checkLatency(initialMetrics);
      return result;
    } catch (error) {
      initialMetrics.total = Date.now() - startTotal;
      metricsLogger.logMetrics(initialMetrics, context, error as Error);
      throw error;
    }
  }
}












