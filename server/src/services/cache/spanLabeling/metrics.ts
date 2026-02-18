/** Narrow metrics interface — avoids importing the concrete MetricsService class. */
export interface SpanLabelingCacheMetrics {
  recordCacheHit(cacheType: string): void;
  recordCacheMiss(cacheType: string): void;
  recordHistogram(name: string, value: number): void;
}

export function recordCacheHit(metrics: SpanLabelingCacheMetrics | undefined, cacheType: string, durationMs?: number): void {
  metrics?.recordCacheHit(cacheType);
  if (durationMs !== undefined) {
    metrics?.recordHistogram('cache_retrieval_time_ms', durationMs);
  }
}

export function recordCacheMiss(metrics: SpanLabelingCacheMetrics | undefined, cacheType: string): void {
  metrics?.recordCacheMiss(cacheType);
}
