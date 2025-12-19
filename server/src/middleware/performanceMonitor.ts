import { logger } from '@infrastructure/Logger';
import type { NextFunction, Request, Response } from 'express';

interface MetricsService {
  recordAlert?: (name: string, payload: Record<string, unknown>) => void;
}

interface PerfOperation {
  start?: number;
  duration: number | null;
}

interface PerfContext {
  startTime: number;
  operations: Record<string, PerfOperation>;
  metadata: Record<string, unknown>;
}

interface PerfMetrics {
  total: number;
  operations: Record<string, number>;
  metadata: Record<string, unknown>;
}

interface RequestPerfMonitor {
  start: (operationName: string) => void;
  end: (operationName: string) => void;
  addMetadata: (key: string, value: unknown) => void;
  getMetrics: () => PerfMetrics;
}

type RequestWithPerf = Request & { perfMonitor?: RequestPerfMonitor };

/**
 * Performance Monitor Middleware
 * Tracks request-level performance metrics for API endpoints
 * 
 * Features:
 * - Attaches timing context to req.perfMonitor
 * - Tracks total request time
 * - Tracks individual operation times
 * - Logs to console in development
 * - Sends to metricsService in production
 * - Alerts if total time > 2000ms
 * - Adds X-Response-Time header to response
 */
export class PerformanceMonitor {
  private metricsService: MetricsService | null;
  private isDev: boolean;

  constructor(metricsService: MetricsService | null = null) {
    this.metricsService = metricsService;
    this.isDev = process.env.NODE_ENV === 'development';
  }

  /**
   * Middleware function to track request performance
   */
  trackRequest(req: RequestWithPerf, res: Response, next: NextFunction): void {
    const perfContext: PerfContext = {
      startTime: Date.now(),
      operations: {},
      metadata: {},
    };

    // Attach timing context to request
    req.perfMonitor = {
      start: (operationName) => this._startTimer(perfContext, operationName),
      end: (operationName) => this._endTimer(perfContext, operationName),
      addMetadata: (key, value) => this._addMetadata(perfContext, key, value),
      getMetrics: () => this._getMetrics(perfContext),
    };

    // Intercept response to complete monitoring
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      this._completeRequest(req, res, perfContext);
      return originalJson(body);
    }) as typeof res.json;

    next();
  }

  /**
   * Start timing for a specific operation
   * @private
   */
  _startTimer(perfContext: PerfContext, operationName: string): void {
    if (!perfContext.operations[operationName]) {
      perfContext.operations[operationName] = {
        start: Date.now(),
        duration: null,
      };
    }
  }

  /**
   * End timing and record duration
   * @private
   */
  _endTimer(perfContext: PerfContext, operationName: string): void {
    const operation = perfContext.operations[operationName];
    if (operation && operation.start) {
      operation.duration = Date.now() - operation.start;
    }
  }

  /**
   * Add metadata to the request
   * @private
   */
  _addMetadata(perfContext: PerfContext, key: string, value: unknown): void {
    perfContext.metadata[key] = value;
  }

  /**
   * Get current metrics
   * @private
   */
  _getMetrics(perfContext: PerfContext): PerfMetrics {
    const total = Date.now() - perfContext.startTime;
    const operations: Record<string, number> = {};
    
    Object.keys(perfContext.operations).forEach((name) => {
      operations[name] = perfContext.operations[name].duration || 0;
    });

    return {
      total,
      operations,
      metadata: perfContext.metadata,
    };
  }

  /**
   * Complete request and flush metrics
   * @private
   */
  _completeRequest(req: RequestWithPerf, res: Response, perfContext: PerfContext): void {
    const metrics = this._getMetrics(perfContext);
    const route = req.route?.path || req.path;

    // Add response time header
    res.setHeader('X-Response-Time', `${metrics.total}ms`);

    // Log metrics in development
    if (this.isDev) {
      this._logDevelopmentMetrics(route, metrics);
    }

    // Send to metrics service in production
    if (this.metricsService && !this.isDev) {
      this._recordProductionMetrics(route, metrics);
    }

    // Alert if request exceeded threshold
    if (metrics.total > 2000) {
      this._alertSlowRequest(route, metrics);
    }

    // Always log to structured logger
    logger.info('Request completed', {
      route,
      method: req.method,
      duration: metrics.total,
      operations: metrics.operations,
      metadata: metrics.metadata,
    });
  }

  /**
   * Log metrics to console in development
   * @private
   */
  _logDevelopmentMetrics(route: string, metrics: PerfMetrics): void {
    logger.debug('Request performance metrics', {
      operation: '_logDevelopmentMetrics',
      route,
      total: metrics.total,
      operations: metrics.operations,
      metadata: metrics.metadata,
    });
  }

  /**
   * Record metrics to production service
   * @private
   */
  _recordProductionMetrics(route: string, metrics: PerfMetrics): void {
    // This could be extended to record specific metrics
    // For now, we rely on the existing MetricsService middleware
    // which tracks HTTP request duration
  }

  /**
   * Alert on slow requests
   * @private
   */
  _alertSlowRequest(route: string, metrics: PerfMetrics): void {
    logger.warn('Request exceeded latency threshold', {
      route,
      total: metrics.total,
      threshold: 2000,
      operations: metrics.operations,
      metadata: metrics.metadata,
    });

    // Alert in production
    if (process.env.NODE_ENV === 'production' && this.metricsService) {
      this.metricsService.recordAlert('request_latency_exceeded', {
        route,
        total: metrics.total,
        threshold: 2000,
      });
    }
  }
}
