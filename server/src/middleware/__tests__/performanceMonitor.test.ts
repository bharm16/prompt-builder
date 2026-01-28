import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { PerformanceMonitor } from '../performanceMonitor';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { logger } from '@infrastructure/Logger';

type RequestWithPerf = Request & {
  perfMonitor?: {
    start: (name: string) => void;
    end: (name: string) => void;
    addMetadata: (key: string, value: unknown) => void;
    getMetrics: () => { total: number; operations: Record<string, number>; metadata: Record<string, unknown> };
  };
  route?: { path: string };
};

function createMockRequest(options: { path?: string; method?: string; route?: { path: string } } = {}): RequestWithPerf {
  return {
    path: options.path || '/test',
    method: options.method || 'GET',
    route: options.route,
  } as RequestWithPerf;
}

function createMockResponse(): Response & { jsonCalled: boolean; headerSet: Record<string, string> } {
  const res = {
    jsonCalled: false,
    headerSet: {} as Record<string, string>,
    json: vi.fn().mockImplementation(function(this: Response) {
      (this as Response & { jsonCalled: boolean }).jsonCalled = true;
      return this;
    }),
    setHeader: vi.fn().mockImplementation(function(this: Response, name: string, value: string) {
      (this as Response & { headerSet: Record<string, string> }).headerSet[name] = value;
      return this;
    }),
  };
  return res as unknown as Response & { jsonCalled: boolean; headerSet: Record<string, string> };
}

describe('PerformanceMonitor', () => {
  let originalEnv: string | undefined;
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalEnv = process.env.NODE_ENV;
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.NODE_ENV = originalEnv;
  });

  describe('trackRequest middleware', () => {
    it('attaches perfMonitor to request', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      expect(req.perfMonitor).toBeDefined();
      expect(typeof req.perfMonitor?.start).toBe('function');
      expect(typeof req.perfMonitor?.end).toBe('function');
      expect(typeof req.perfMonitor?.addMetadata).toBe('function');
      expect(typeof req.perfMonitor?.getMetrics).toBe('function');
    });

    it('calls next after setup', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('intercepts res.json to complete monitoring', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      res.json({ data: 'test' });

      expect(res.jsonCalled).toBe(true);
    });
  });

  describe('timing operations', () => {
    it('tracks operation duration correctly', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      req.perfMonitor?.start('llm-call');
      vi.advanceTimersByTime(100);
      req.perfMonitor?.end('llm-call');

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.operations['llm-call']).toBe(100);
    });

    it('tracks multiple operations independently', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      req.perfMonitor?.start('db-query');
      vi.advanceTimersByTime(50);
      req.perfMonitor?.end('db-query');

      req.perfMonitor?.start('cache-check');
      vi.advanceTimersByTime(10);
      req.perfMonitor?.end('cache-check');

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.operations['db-query']).toBe(50);
      expect(metrics?.operations['cache-check']).toBe(10);
    });

    it('returns 0 for operations that were started but not ended', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      req.perfMonitor?.start('pending-op');
      vi.advanceTimersByTime(100);
      // Not calling end

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.operations['pending-op']).toBe(0);
    });

    it('ignores end for non-started operations', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      req.perfMonitor?.end('never-started');

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.operations['never-started']).toBeUndefined();
    });

    it('does not restart already started operation', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      req.perfMonitor?.start('op');
      vi.advanceTimersByTime(50);
      req.perfMonitor?.start('op'); // Second start should be ignored
      vi.advanceTimersByTime(50);
      req.perfMonitor?.end('op');

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.operations['op']).toBe(100);
    });
  });

  describe('metadata handling', () => {
    it('stores metadata correctly', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      req.perfMonitor?.addMetadata('model', 'gpt-4');
      req.perfMonitor?.addMetadata('tokens', 1500);

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.metadata).toEqual({
        model: 'gpt-4',
        tokens: 1500,
      });
    });

    it('overwrites metadata with same key', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);

      req.perfMonitor?.addMetadata('count', 1);
      req.perfMonitor?.addMetadata('count', 2);

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.metadata.count).toBe(2);
    });
  });

  describe('total time tracking', () => {
    it('calculates total request time', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(250);

      const metrics = req.perfMonitor?.getMetrics();
      expect(metrics?.total).toBe(250);
    });
  });

  describe('response completion', () => {
    it('sets X-Response-Time header', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(150);
      res.json({ data: 'test' });

      expect(res.headerSet['X-Response-Time']).toBe('150ms');
    });

    it('uses route path when available', () => {
      const req = createMockRequest({ route: { path: '/api/users/:id' } });
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      res.json({});

      expect(logger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ route: '/api/users/:id' })
      );
    });

    it('falls back to req.path when route not available', () => {
      const req = createMockRequest({ path: '/fallback/path' });
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      res.json({});

      expect(logger.info).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({ route: '/fallback/path' })
      );
    });
  });

  describe('slow request alerting', () => {
    it('logs warning for requests exceeding 2000ms', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(2500);
      res.json({});

      expect(logger.warn).toHaveBeenCalledWith(
        'Request exceeded latency threshold',
        expect.objectContaining({
          total: 2500,
          threshold: 2000,
        })
      );
    });

    it('does not warn for requests under 2000ms', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(1999);
      res.json({});

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not warn for exactly 2000ms', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      monitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(2000);
      res.json({});

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('metrics service integration', () => {
    it('records alert to metrics service in production for slow requests', () => {
      process.env.NODE_ENV = 'production';
      const mockMetricsService = { recordAlert: vi.fn() };
      const prodMonitor = new PerformanceMonitor(mockMetricsService);
      const req = createMockRequest({ path: '/slow' });
      const res = createMockResponse();
      const next = vi.fn();

      prodMonitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(2500);
      res.json({});

      expect(mockMetricsService.recordAlert).toHaveBeenCalledWith(
        'request_latency_exceeded',
        expect.objectContaining({
          route: '/slow',
          total: 2500,
          threshold: 2000,
        })
      );
    });

    it('does not record alert in development mode', () => {
      process.env.NODE_ENV = 'development';
      const mockMetricsService = { recordAlert: vi.fn() };
      const devMonitor = new PerformanceMonitor(mockMetricsService);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      devMonitor.trackRequest(req, res, next);
      vi.advanceTimersByTime(2500);
      res.json({});

      expect(mockMetricsService.recordAlert).not.toHaveBeenCalled();
    });
  });

  describe('development logging', () => {
    it('logs debug metrics in development mode', () => {
      process.env.NODE_ENV = 'development';
      const devMonitor = new PerformanceMonitor();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      devMonitor.trackRequest(req, res, next);
      res.json({});

      expect(logger.debug).toHaveBeenCalledWith(
        'Request performance metrics',
        expect.any(Object)
      );
    });
  });
});
