import { metricsService } from '@infrastructure/MetricsService';

export function recordCacheHit(cacheType: string, durationMs?: number): void {
  metricsService.recordCacheHit(cacheType);
  if (durationMs !== undefined) {
    metricsService.recordHistogram('cache_retrieval_time_ms', durationMs);
  }
}

export function recordCacheMiss(cacheType: string): void {
  metricsService.recordCacheMiss(cacheType);
}
