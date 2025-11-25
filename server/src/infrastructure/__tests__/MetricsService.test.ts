import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsService } from '../MetricsService';
import type { IMetricsCollector } from '@interfaces/IMetricsCollector';

function findMetric(metrics: Array<{ name: string; [key: string]: unknown }>, name: string) {
  return metrics.find((m) => m.name === name);
}

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('records Claude API calls and durations', async () => {
    service.recordClaudeAPICall('messages', 1200, true, 'code');
    const json = await service.getMetricsJSON();
    const calls = findMetric(json, 'claude_api_calls_total');
    expect(calls).toBeDefined();
    if (calls && 'values' in calls && Array.isArray(calls.values)) {
      const labels = calls.values.map((v: { labels?: { status?: string } }) => v.labels?.status);
      expect(labels).toContain('success');
    }
  });

  it('updates cache hit rate and coalesced requests', async () => {
    service.updateCacheHitRate('default', 42);
    service.recordCoalescedRequest('middleware');
    const json = await service.getMetricsJSON();
    expect(findMetric(json, 'cache_hit_rate')).toBeDefined();
    expect(findMetric(json, 'coalesced_requests_total')).toBeDefined();
  });

  it('HTTP middleware records request metrics on finish', async () => {
    const mw = service.middleware();
    const req = { method: 'GET', path: '/test', route: { path: '/test' } };
    const res = {
      statusCode: 200,
      _events: {} as Record<string, (() => void) | undefined>,
      on(evt: string, cb: () => void) {
        this._events[evt] = cb;
      },
      emit(evt: string) {
        if (this._events[evt]) {
          this._events[evt]?.();
        }
      },
    };
    const next = () => {};
    mw(req as unknown as Parameters<typeof mw>[0], res as unknown as Parameters<typeof mw>[1], next);
    res.emit('finish');
    const json = await service.getMetricsJSON();
    const httpTotal = findMetric(json, 'http_requests_total');
    expect(httpTotal).toBeDefined();
    if (httpTotal && 'values' in httpTotal && Array.isArray(httpTotal.values)) {
      const hasRoute = httpTotal.values.some((v: { labels?: { route?: string } }) => v.labels?.route === '/test');
      expect(hasRoute).toBe(true);
    }
  });
});

