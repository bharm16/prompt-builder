import { describe, it, expect } from 'vitest';
import { MetricsService } from '../MetricsService.ts';

function findMetric(metrics, name) {
  return metrics.find((m) => m.name === name);
}

describe('MetricsService', () => {
  it('records Claude API calls and durations', async () => {
    const ms = new MetricsService();
    ms.recordClaudeAPICall('messages', 1200, true, 'code');
    const json = await ms.getMetricsJSON();
    const calls = findMetric(json, 'claude_api_calls_total');
    expect(calls).toBeDefined();
    const labels = calls.values.map((v) => v.labels.status);
    expect(labels).toContain('success');
  });

  it('updates cache hit rate and coalesced requests', async () => {
    const ms = new MetricsService();
    ms.updateCacheHitRate('default', 42);
    ms.recordCoalescedRequest('middleware');
    const json = await ms.getMetricsJSON();
    expect(findMetric(json, 'cache_hit_rate')).toBeDefined();
    expect(findMetric(json, 'coalesced_requests_total')).toBeDefined();
  });

  it('HTTP middleware records request metrics on finish', async () => {
    const ms = new MetricsService();
    const mw = ms.middleware();
    const req = { method: 'GET', path: '/test', route: { path: '/test' } };
    const res = {
      statusCode: 200,
      _events: {},
      on(evt, cb) { this._events[evt] = cb; },
      emit(evt) { if (this._events[evt]) this._events[evt](); },
    };
    const next = () => {};
    mw(req, res, next);
    res.emit('finish');
    const json = await ms.getMetricsJSON();
    const httpTotal = findMetric(json, 'http_requests_total');
    expect(httpTotal).toBeDefined();
    const hasRoute = httpTotal.values.some((v) => v.labels.route === '/test');
    expect(hasRoute).toBe(true);
  });
});

