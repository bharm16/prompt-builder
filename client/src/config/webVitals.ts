/**
 * Core Web Vitals reporting — sends LCP, CLS, INP, FCP, and TTFB
 * metrics to Sentry as custom measurements.
 *
 * These complement the existing application-level performance marks
 * (optimization timing, span labeling latency) with browser-level
 * user experience metrics.
 *
 * @see https://web.dev/articles/vitals
 */

import * as Sentry from '@sentry/react';
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { logger } from '@/services/LoggingService';

const log = logger.child('webVitals');

/**
 * Report a single web-vitals metric to Sentry as a custom measurement
 * and log it in development for observability.
 */
function reportMetric(metric: Metric): void {
  const { name, value, rating } = metric;

  // Development logging for local profiling
  if (import.meta.env.DEV) {
    log.info(`${name}: ${Math.round(value)}ms [${rating}]`, {
      operation: 'webVitals',
      metric: name,
      value: Math.round(value),
      rating,
    });
  }

  // Report to Sentry as a custom measurement attached to the active span
  Sentry.setMeasurement(name, value, name === 'CLS' ? '' : 'millisecond');

  // Tag the rating so we can filter in Sentry (good / needs-improvement / poor)
  Sentry.setTag(`web_vital.${name.toLowerCase()}`, rating);
}

/**
 * Initialize Core Web Vitals collection.
 * Call once at application startup (non-blocking).
 *
 * Metrics collected:
 * - LCP  (Largest Contentful Paint) — loading performance
 * - CLS  (Cumulative Layout Shift)  — visual stability
 * - INP  (Interaction to Next Paint) — responsiveness
 * - FCP  (First Contentful Paint)    — initial render speed
 * - TTFB (Time to First Byte)        — server response time
 */
export function initWebVitals(): void {
  try {
    onLCP(reportMetric);
    onCLS(reportMetric);
    onINP(reportMetric);
    onFCP(reportMetric);
    onTTFB(reportMetric);
  } catch (error) {
    // Non-critical — don't let metrics collection crash the app
    log.warn('Failed to initialize web vitals', {
      operation: 'initWebVitals',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
