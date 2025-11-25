import { logger } from '../infrastructure/Logger.ts';

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
  constructor(metricsService = null) {
    this.metricsService = metricsService;
    this.isDev = process.env.NODE_ENV === 'development';
  }

  /**
   * Middleware function to track request performance
   */
  trackRequest(req, res, next) {
    const perfContext = {
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
    res.json = (body) => {
      this._completeRequest(req, res, perfContext);
      return originalJson(body);
    };

    next();
  }

  /**
   * Start timing for a specific operation
   * @private
   */
  _startTimer(perfContext, operationName) {
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
  _endTimer(perfContext, operationName) {
    const operation = perfContext.operations[operationName];
    if (operation && operation.start) {
      operation.duration = Date.now() - operation.start;
    }
  }

  /**
   * Add metadata to the request
   * @private
   */
  _addMetadata(perfContext, key, value) {
    perfContext.metadata[key] = value;
  }

  /**
   * Get current metrics
   * @private
   */
  _getMetrics(perfContext) {
    const total = Date.now() - perfContext.startTime;
    const operations = {};
    
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
  _completeRequest(req, res, perfContext) {
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
  _logDevelopmentMetrics(route, metrics) {
    console.log('\n=== Request Performance ===');
    console.log(`Route: ${route}`);
    console.log(`Total: ${metrics.total}ms`);
    
    if (Object.keys(metrics.operations).length > 0) {
      console.log('\nOperations:');
      Object.entries(metrics.operations).forEach(([name, duration]) => {
        console.log(`  ${name}: ${duration}ms`);
      });
    }

    if (Object.keys(metrics.metadata).length > 0) {
      console.log('\nMetadata:');
      Object.entries(metrics.metadata).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    console.log('==========================\n');
  }

  /**
   * Record metrics to production service
   * @private
   */
  _recordProductionMetrics(route, metrics) {
    // This could be extended to record specific metrics
    // For now, we rely on the existing MetricsService middleware
    // which tracks HTTP request duration
  }

  /**
   * Alert on slow requests
   * @private
   */
  _alertSlowRequest(route, metrics) {
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

