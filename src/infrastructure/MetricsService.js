import promClient from 'prom-client';

/**
 * Prometheus metrics service for application observability
 * Tracks HTTP requests, API calls, cache performance, and business metrics
 */
export class MetricsService {
  constructor() {
    this.register = new promClient.Registry();

    // Collect default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({ register: this.register });

    // HTTP request duration histogram
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // HTTP request total counter
    this.httpRequestsTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // Claude API calls counter
    this.claudeAPICallsTotal = new promClient.Counter({
      name: 'claude_api_calls_total',
      help: 'Total Claude API calls',
      labelNames: ['endpoint', 'status'],
      registers: [this.register],
    });

    // Claude API duration histogram
    this.claudeAPIDuration = new promClient.Histogram({
      name: 'claude_api_duration_seconds',
      help: 'Duration of Claude API calls in seconds',
      labelNames: ['endpoint'],
      buckets: [1, 2, 5, 10, 15, 20, 30],
      registers: [this.register],
    });

    // Cache hit/miss counter
    this.cacheHits = new promClient.Counter({
      name: 'cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['cache_type'],
      registers: [this.register],
    });

    this.cacheMisses = new promClient.Counter({
      name: 'cache_misses_total',
      help: 'Total cache misses',
      labelNames: ['cache_type'],
      registers: [this.register],
    });

    // Cache hit rate gauge
    this.cacheHitRate = new promClient.Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.register],
    });

    // Circuit breaker state gauge
    this.circuitBreakerState = new promClient.Gauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['circuit'],
      registers: [this.register],
    });

    // Active requests gauge
    this.activeRequests = new promClient.Gauge({
      name: 'http_active_requests',
      help: 'Number of active HTTP requests',
      labelNames: ['method', 'route'],
      registers: [this.register],
    });
  }

  /**
   * Express middleware for HTTP metrics
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      const route = req.route?.path || req.path;

      // Increment active requests
      this.activeRequests.inc({ method: req.method, route });

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;

        // Record metrics
        this.httpRequestDuration.observe(
          { method: req.method, route, status_code: res.statusCode },
          duration
        );

        this.httpRequestsTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode,
        });

        // Decrement active requests
        this.activeRequests.dec({ method: req.method, route });
      });

      next();
    };
  }

  /**
   * Record Claude API call
   */
  recordClaudeAPICall(endpoint, duration, success) {
    this.claudeAPICallsTotal.inc({
      endpoint,
      status: success ? 'success' : 'error',
    });

    if (duration) {
      this.claudeAPIDuration.observe({ endpoint }, duration / 1000);
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType) {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType) {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(cacheType, hitRate) {
    this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  /**
   * Update circuit breaker state
   * @param {string} circuit - Circuit name
   * @param {string} state - State: 'closed', 'open', or 'half-open'
   */
  updateCircuitBreakerState(circuit, state) {
    const stateMap = { closed: 0, open: 1, 'half-open': 2 };
    this.circuitBreakerState.set({ circuit }, stateMap[state] || 0);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON() {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
