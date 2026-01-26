import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { MetricsService } from '../MetricsService';

const promMocks = vi.hoisted(() => {
  const createdMetrics = new Map<string, any>();

  class FakeCounter {
    name: string;
    inc = vi.fn();
    constructor(options: { name: string }) {
      this.name = options.name;
      createdMetrics.set(this.name, this);
    }
  }

  class FakeHistogram {
    name: string;
    observe = vi.fn();
    constructor(options: { name: string }) {
      this.name = options.name;
      createdMetrics.set(this.name, this);
    }
  }

  class FakeGauge {
    name: string;
    set = vi.fn();
    inc = vi.fn();
    dec = vi.fn();
    constructor(options: { name: string }) {
      this.name = options.name;
      createdMetrics.set(this.name, this);
    }
  }

  class FakeRegistry {
    metrics = vi.fn(async () => 'metrics');
    getMetricsAsJSON = vi.fn(async () => [{ name: 'metric' }]);
  }

  const collectDefaultMetrics = vi.fn();

  return {
    createdMetrics,
    FakeCounter,
    FakeHistogram,
    FakeGauge,
    FakeRegistry,
    collectDefaultMetrics,
  };
});

const warnSpy = vi.hoisted(() => vi.fn());

vi.mock('prom-client', () => ({
  default: {
    Registry: promMocks.FakeRegistry,
    Counter: promMocks.FakeCounter,
    Histogram: promMocks.FakeHistogram,
    Gauge: promMocks.FakeGauge,
    collectDefaultMetrics: promMocks.collectDefaultMetrics,
  },
  Registry: promMocks.FakeRegistry,
  Counter: promMocks.FakeCounter,
  Histogram: promMocks.FakeHistogram,
  Gauge: promMocks.FakeGauge,
  collectDefaultMetrics: promMocks.collectDefaultMetrics,
}));

vi.mock('../Logger.ts', () => ({
  logger: {
    warn: warnSpy,
  },
}));

describe('MetricsService', () => {
  const getMetric = (name: string) => promMocks.createdMetrics.get(name) as { inc?: ReturnType<typeof vi.fn>; observe?: ReturnType<typeof vi.fn>; set?: ReturnType<typeof vi.fn>; dec?: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    promMocks.createdMetrics.clear();
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('skips duration observation when duration is undefined', () => {
      const service = new MetricsService();

      service.recordClaudeAPICall('classify', undefined, false, 'fast');

      expect(getMetric('claude_api_calls_total').inc).toHaveBeenCalledWith({
        endpoint: 'classify',
        status: 'error',
        mode: 'fast',
      });
      expect(getMetric('claude_api_duration_seconds').observe).not.toHaveBeenCalled();
    });

    it('ignores unknown counter names', () => {
      const service = new MetricsService();

      service.recordCounter('unknown_counter');

      expect(getMetric('suggestion_accepted_total').inc).not.toHaveBeenCalled();
      expect(getMetric('suggestion_rejected_total').inc).not.toHaveBeenCalled();
      expect(getMetric('undo_actions_total').inc).not.toHaveBeenCalled();
    });

    it('ignores unknown gauges and histograms', () => {
      const service = new MetricsService();

      service.recordGauge('unknown_gauge', 5);
      service.recordHistogram('unknown_histogram', 12);

      expect(getMetric('request_queue_length').set).not.toHaveBeenCalled();
      expect(getMetric('request_queue_time_ms').observe).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('records token usage only for defined values', () => {
      const service = new MetricsService();

      service.recordTokenUsage(undefined, 5, 'mode-x');

      const tokenCounter = getMetric('claude_tokens_total');
      expect(tokenCounter.inc).toHaveBeenCalledTimes(1);
      expect(tokenCounter.inc).toHaveBeenCalledWith({ type: 'output', mode: 'mode-x' }, 5);
    });

    it('records enhancement timing metrics with conditional fields', () => {
      const service = new MetricsService();

      service.recordEnhancementTiming(
        {
          total: 2500,
          cacheCheck: 10,
          semanticDeps: 0,
          modelDetection: 15,
          sectionDetection: 5,
          groqCall: 0,
          postProcessing: 12,
          cache: true,
        },
        {
          category: 'style',
          isVideo: true,
          error: true,
          modelTarget: 'v1',
          promptSection: 'intro',
        }
      );

      expect(getMetric('enhancement_total_duration_ms').observe).toHaveBeenCalledWith(
        { category: 'style', isVideo: 'true', error: 'true' },
        2500
      );
      expect(getMetric('enhancement_cache_check_ms').observe).toHaveBeenCalledWith(
        { category: 'style', isVideo: 'true' },
        10
      );
      expect(getMetric('enhancement_semantic_analysis_ms').observe).not.toHaveBeenCalled();
      expect(getMetric('enhancement_model_detection_ms').observe).toHaveBeenCalledWith(
        { modelTarget: 'v1' },
        15
      );
      expect(getMetric('enhancement_section_detection_ms').observe).toHaveBeenCalledWith(
        { section: 'intro' },
        5
      );
      expect(getMetric('enhancement_groq_call_ms').observe).not.toHaveBeenCalled();
      expect(getMetric('enhancement_post_processing_ms').observe).toHaveBeenCalledWith(
        { category: 'style' },
        12
      );
      expect(getMetric('enhancement_requests_total').inc).toHaveBeenCalledWith({
        category: 'style',
        isVideo: 'true',
        cache: 'hit',
      });
      expect(getMetric('enhancement_slow_requests_total').inc).toHaveBeenCalledWith({
        category: 'style',
        isVideo: 'true',
      });
    });
  });

  describe('core behavior', () => {
    it('records HTTP metrics via middleware', () => {
      const service = new MetricsService();
      const middleware = service.middleware();
      const next = vi.fn();
      const nowSpy = vi.spyOn(Date, 'now');
      nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const resEmitter = new EventEmitter();
      const res = Object.assign(resEmitter, {
        statusCode: 201,
        on: resEmitter.on.bind(resEmitter),
      }) as unknown as { statusCode: number; on: EventEmitter['on'] };

      const req = {
        method: 'POST',
        path: '/fallback',
        route: { path: '/route' },
      } as unknown as { method: string; path: string; route?: { path?: string } };

      middleware(req as any, res as any, next);
      resEmitter.emit('finish');

      expect(getMetric('http_request_duration_seconds').observe).toHaveBeenCalledWith(
        { method: 'POST', route: '/route', status_code: '201' },
        1
      );
      expect(getMetric('http_requests_total').inc).toHaveBeenCalledWith({
        method: 'POST',
        route: '/route',
        status_code: '201',
      });
      expect(getMetric('http_active_requests').inc).toHaveBeenCalledWith({
        method: 'POST',
        route: '/route',
      });
      expect(getMetric('http_active_requests').dec).toHaveBeenCalledWith({
        method: 'POST',
        route: '/route',
      });
      expect(next).toHaveBeenCalled();
    });
  });
});
