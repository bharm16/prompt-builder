import promClient from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './Logger.ts';
import type { IMetricsCollector } from '@interfaces/IMetricsCollector';

interface EnhancementTimingMetrics {
  total?: number;
  cacheCheck?: number;
  semanticDeps?: number;
  modelDetection?: number;
  sectionDetection?: number;
  groqCall?: number;
  postProcessing?: number;
  cache?: boolean;
}

interface EnhancementMetadata {
  category?: string;
  isVideo?: boolean;
  error?: boolean;
  modelTarget?: string;
  promptSection?: string;
}

/**
 * Prometheus metrics service for application observability
 * Tracks HTTP requests, API calls, cache performance, and business metrics
 */
export class MetricsService implements IMetricsCollector {
  private register: promClient.Registry;
  private httpRequestDuration: promClient.Histogram<string>;
  private httpRequestsTotal: promClient.Counter<string>;
  private claudeAPICallsTotal: promClient.Counter<string>;
  private claudeAPIDuration: promClient.Histogram<string>;
  private claudeTokensTotal: promClient.Counter<string>;
  private coalescedRequests: promClient.Counter<string>;
  private cacheHits: promClient.Counter<string>;
  private cacheMisses: promClient.Counter<string>;
  private cacheHitRate: promClient.Gauge<string>;
  private circuitBreakerState: promClient.Gauge<string>;
  private activeRequests: promClient.Gauge<string>;
  private requestQueueLength: promClient.Gauge;
  private requestQueueTime: promClient.Histogram;
  private enhancementTotalDuration: promClient.Histogram<string>;
  private enhancementCacheCheck: promClient.Histogram<string>;
  private enhancementSemanticAnalysis: promClient.Histogram<string>;
  private enhancementModelDetection: promClient.Histogram<string>;
  private enhancementSectionDetection: promClient.Histogram<string>;
  private enhancementGroqCall: promClient.Histogram<string>;
  private enhancementPostProcessing: promClient.Histogram<string>;
  private enhancementRequestsTotal: promClient.Counter<string>;
  private enhancementSlowRequests: promClient.Counter<string>;
  private alertsTotal: promClient.Counter<string>;
  private suggestionAcceptedTotal: promClient.Counter<string>;
  private suggestionRejectedTotal: promClient.Counter<string>;
  private undoActionsTotal: promClient.Counter<string>;
  private modelRecommendationRequestsTotal: promClient.Counter<string>;
  private modelRecommendationEventsTotal: promClient.Counter<string>;
  private modelRecommendationTimeToGeneration: promClient.Histogram<string>;
  private llmOperationDuration: promClient.Histogram<string>;
  private llmTokensTotal: promClient.Counter<string>;
  private llmCostDollarsTotal: promClient.Counter<string>;
  private llmRepairAppliedTotal: promClient.Counter<string>;
  private optimizationQualityGateTotal: promClient.Counter<string>;
  private optimizationQualityGateScore: promClient.Histogram<string>;

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

    // Claude API calls counter (enhanced with mode tracking)
    this.claudeAPICallsTotal = new promClient.Counter({
      name: 'claude_api_calls_total',
      help: 'Total Claude API calls',
      labelNames: ['endpoint', 'status', 'mode'],
      registers: [this.register],
    });

    // Claude API duration histogram (enhanced with mode tracking)
    this.claudeAPIDuration = new promClient.Histogram({
      name: 'claude_api_duration_seconds',
      help: 'Duration of Claude API calls in seconds',
      labelNames: ['endpoint', 'mode'],
      buckets: [1, 2, 5, 10, 15, 20, 30, 45, 60],
      registers: [this.register],
    });

    // Token usage counter (new metric for cost tracking)
    this.claudeTokensTotal = new promClient.Counter({
      name: 'claude_tokens_total',
      help: 'Total tokens consumed by Claude API',
      labelNames: ['type', 'mode'], // type: input or output
      registers: [this.register],
    });

    // Request coalescing metrics (new)
    this.coalescedRequests = new promClient.Counter({
      name: 'coalesced_requests_total',
      help: 'Total number of coalesced requests',
      labelNames: ['type'], // type: middleware or client
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

    // Request queue length gauge
    this.requestQueueLength = new promClient.Gauge({
      name: 'request_queue_length',
      help: 'Current number of requests in the queue',
      registers: [this.register],
    });

    // Request queue time histogram
    this.requestQueueTime = new promClient.Histogram({
      name: 'request_queue_time_ms',
      help: 'Time requests spend in queue in milliseconds',
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.register],
    });

    // Enhancement service performance metrics
    this.enhancementTotalDuration = new promClient.Histogram({
      name: 'enhancement_total_duration_ms',
      help: 'Total duration of enhancement requests in milliseconds',
      labelNames: ['category', 'isVideo', 'error'],
      buckets: [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000],
      registers: [this.register],
    });

    this.enhancementCacheCheck = new promClient.Histogram({
      name: 'enhancement_cache_check_ms',
      help: 'Duration of cache check in enhancement requests',
      labelNames: ['category', 'isVideo'],
      buckets: [1, 5, 10, 25, 50, 100],
      registers: [this.register],
    });

    this.enhancementSemanticAnalysis = new promClient.Histogram({
      name: 'enhancement_semantic_analysis_ms',
      help: 'Duration of semantic dependency analysis',
      labelNames: ['category'],
      buckets: [1, 5, 10, 25, 50, 100],
      registers: [this.register],
    });

    this.enhancementModelDetection = new promClient.Histogram({
      name: 'enhancement_model_detection_ms',
      help: 'Duration of model target detection',
      labelNames: ['modelTarget'],
      buckets: [1, 5, 10, 25, 50, 100],
      registers: [this.register],
    });

    this.enhancementSectionDetection = new promClient.Histogram({
      name: 'enhancement_section_detection_ms',
      help: 'Duration of prompt section detection',
      labelNames: ['section'],
      buckets: [1, 5, 10, 25, 50, 100],
      registers: [this.register],
    });

    this.enhancementGroqCall = new promClient.Histogram({
      name: 'enhancement_groq_call_ms',
      help: 'Duration of Groq API call in enhancement requests',
      labelNames: ['category', 'isVideo'],
      buckets: [100, 250, 500, 750, 1000, 1500, 2000, 3000],
      registers: [this.register],
    });

    this.enhancementPostProcessing = new promClient.Histogram({
      name: 'enhancement_post_processing_ms',
      help: 'Duration of post-processing in enhancement requests',
      labelNames: ['category'],
      buckets: [10, 25, 50, 100, 150, 250, 500],
      registers: [this.register],
    });

    this.enhancementRequestsTotal = new promClient.Counter({
      name: 'enhancement_requests_total',
      help: 'Total number of enhancement requests',
      labelNames: ['category', 'isVideo', 'cache'],
      registers: [this.register],
    });

    this.enhancementSlowRequests = new promClient.Counter({
      name: 'enhancement_slow_requests_total',
      help: 'Total number of enhancement requests that exceeded 2s',
      labelNames: ['category', 'isVideo'],
      registers: [this.register],
    });

    // Alert counter
    this.alertsTotal = new promClient.Counter({
      name: 'alerts_total',
      help: 'Total number of alerts triggered',
      labelNames: ['alert'],
      registers: [this.register],
    });

    // User analytics counters
    this.suggestionAcceptedTotal = new promClient.Counter({
      name: 'suggestion_accepted_total',
      help: 'Total number of accepted suggestions',
      labelNames: ['category', 'modelTarget', 'cacheHit'],
      registers: [this.register],
    });

    this.suggestionRejectedTotal = new promClient.Counter({
      name: 'suggestion_rejected_total',
      help: 'Total number of rejected suggestions',
      labelNames: ['category', 'modelTarget'],
      registers: [this.register],
    });

    this.undoActionsTotal = new promClient.Counter({
      name: 'undo_actions_total',
      help: 'Total number of undo actions',
      labelNames: ['category'],
      registers: [this.register],
    });

    // Model intelligence metrics
    this.modelRecommendationRequestsTotal = new promClient.Counter({
      name: 'model_recommendation_requests_total',
      help: 'Total model recommendation requests',
      labelNames: ['mode', 'availability'],
      registers: [this.register],
    });

    this.modelRecommendationEventsTotal = new promClient.Counter({
      name: 'model_recommendation_events_total',
      help: 'Total model recommendation events',
      labelNames: ['event', 'mode', 'followed'],
      registers: [this.register],
    });

    this.modelRecommendationTimeToGeneration = new promClient.Histogram({
      name: 'model_recommendation_time_to_generation_ms',
      help: 'Time from recommendation to generation start in milliseconds',
      labelNames: ['followed'],
      buckets: [100, 250, 500, 1000, 2000, 5000, 10000, 20000, 40000],
      registers: [this.register],
    });

    // LLM operation metrics (provider-agnostic, covers OpenAI/Gemini/Groq/Qwen)
    this.llmOperationDuration = new promClient.Histogram({
      name: 'llm_operation_duration_seconds',
      help: 'Duration of LLM operations in seconds by operation and provider',
      labelNames: ['operation', 'provider', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 15, 20, 30, 45, 60],
      registers: [this.register],
    });

    this.llmTokensTotal = new promClient.Counter({
      name: 'llm_tokens_total',
      help: 'Total tokens consumed by LLM operations',
      labelNames: ['type', 'operation', 'provider'],
      registers: [this.register],
    });

    this.llmCostDollarsTotal = new promClient.Counter({
      name: 'llm_cost_dollars_total',
      help: 'Estimated LLM API cost in dollars',
      labelNames: ['operation', 'provider'],
      registers: [this.register],
    });

    this.llmRepairAppliedTotal = new promClient.Counter({
      name: 'llm_repair_applied_total',
      help: 'Total JSON repair attempts on LLM responses',
      labelNames: ['operation', 'repair_type'],
      registers: [this.register],
    });

    // Optimization quality gate metrics
    this.optimizationQualityGateTotal = new promClient.Counter({
      name: 'optimization_quality_gate_total',
      help: 'Total optimization quality gate evaluations',
      labelNames: ['outcome'],
      registers: [this.register],
    });

    this.optimizationQualityGateScore = new promClient.Histogram({
      name: 'optimization_quality_gate_score',
      help: 'Quality assessment scores at the gate decision point',
      labelNames: ['outcome'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      registers: [this.register],
    });
  }

  /**
   * Express middleware for HTTP metrics
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const start = Date.now();
      const route = (req.route?.path as string | undefined) || req.path;

      // Increment active requests
      this.activeRequests.inc({ method: req.method, route });

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;

        // Record metrics
        this.httpRequestDuration.observe(
          { method: req.method, route, status_code: String(res.statusCode) },
          duration
        );

        this.httpRequestsTotal.inc({
          method: req.method,
          route,
          status_code: String(res.statusCode),
        });

        // Decrement active requests
        this.activeRequests.dec({ method: req.method, route });
      });

      next();
    };
  }

  /**
   * Record Claude API call
   * Enhanced with mode tracking for better per-endpoint analysis
   */
  recordClaudeAPICall(endpoint: string, duration: number | undefined, success: boolean, mode: string = 'default'): void {
    this.claudeAPICallsTotal.inc({
      endpoint,
      status: success ? 'success' : 'error',
      mode, // Track which optimization mode was used
    });

    if (duration) {
      this.claudeAPIDuration.observe({ endpoint, mode }, duration / 1000);
    }
  }

  recordSuccess(operation: string, duration: number): void {
    this.recordClaudeAPICall(operation, duration, true);
  }

  recordFailure(operation: string, duration: number): void {
    this.recordClaudeAPICall(operation, duration, false);
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string): void {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string): void {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(cacheType: string, hitRate: number): void {
    this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreakerState(circuit: string, state: 'closed' | 'open' | 'half-open'): void {
    const stateMap: Record<string, number> = { closed: 0, open: 1, 'half-open': 2 };
    this.circuitBreakerState.set({ circuit }, stateMap[state] || 0);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<promClient.MetricObjectWithValues<promClient.MetricValue<string>>[]> {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Record token usage
   */
  recordTokenUsage(inputTokens: number | undefined, outputTokens: number | undefined, mode: string = 'default'): void {
    if (inputTokens) {
      this.claudeTokensTotal.inc({ type: 'input', mode }, inputTokens);
    }
    if (outputTokens) {
      this.claudeTokensTotal.inc({ type: 'output', mode }, outputTokens);
    }
  }

  /**
   * Record coalesced request
   */
  recordCoalescedRequest(type: string = 'middleware'): void {
    this.coalescedRequests.inc({ type });
  }

  /**
   * Record gauge metric
   */
  recordGauge(name: string, value: number): void {
    switch (name) {
      case 'request_queue_length':
        this.requestQueueLength.set(value);
        break;
      default:
        // Silently ignore unknown gauges for now
        break;
    }
  }

  /**
   * Record histogram metric
   */
  recordHistogram(name: string, value: number): void {
    switch (name) {
      case 'request_queue_time_ms':
        this.requestQueueTime.observe(value);
        break;
      default:
        // Silently ignore unknown histograms for now
        break;
    }
  }

  /**
   * Record enhancement timing metrics
   */
  recordEnhancementTiming(metrics: EnhancementTimingMetrics, metadata: EnhancementMetadata = {}): void {
    const category = metadata.category || 'unknown';
    const isVideo = String(metadata.isVideo || false);
    const error = metadata.error ? 'true' : 'false';

    // Record total duration
    this.enhancementTotalDuration.observe(
      { category, isVideo, error },
      metrics.total || 0
    );

    // Record cache check duration
    if (metrics.cacheCheck !== undefined) {
      this.enhancementCacheCheck.observe(
        { category, isVideo },
        metrics.cacheCheck
      );
    }

    // Record semantic analysis duration
    if (metrics.semanticDeps && metrics.semanticDeps > 0) {
      this.enhancementSemanticAnalysis.observe(
        { category },
        metrics.semanticDeps
      );
    }

    // Record model detection duration
    if (metrics.modelDetection && metrics.modelDetection > 0) {
      this.enhancementModelDetection.observe(
        { modelTarget: metadata.modelTarget || 'none' },
        metrics.modelDetection
      );
    }

    // Record section detection duration
    if (metrics.sectionDetection && metrics.sectionDetection > 0) {
      this.enhancementSectionDetection.observe(
        { section: metadata.promptSection || 'main_prompt' },
        metrics.sectionDetection
      );
    }

    // Record Groq call duration
    if (metrics.groqCall && metrics.groqCall > 0) {
      this.enhancementGroqCall.observe(
        { category, isVideo },
        metrics.groqCall
      );
    }

    // Record post-processing duration
    if (metrics.postProcessing && metrics.postProcessing > 0) {
      this.enhancementPostProcessing.observe(
        { category },
        metrics.postProcessing
      );
    }

    // Increment request counter
    this.enhancementRequestsTotal.inc({
      category,
      isVideo,
      cache: metrics.cache ? 'hit' : 'miss',
    });

    // Track slow requests
    if (metrics.total && metrics.total > 2000) {
      this.enhancementSlowRequests.inc({ category, isVideo });
    }
  }

  /**
   * Record alert
   */
  recordAlert(alertName: string, metadata: Record<string, unknown> = {}): void {
    this.alertsTotal.inc({ alert: alertName });
    
    // Log alert for visibility
    logger.warn('Alert triggered', {
      alert: alertName,
      ...metadata,
    });
  }

  /**
   * Record counter metric (generic)
   */
  recordCounter(name: string, labels: Record<string, string> = {}): void {
    switch (name) {
      case 'suggestion_accepted_total':
        this.suggestionAcceptedTotal.inc(labels);
        break;
      case 'suggestion_rejected_total':
        this.suggestionRejectedTotal.inc(labels);
        break;
      case 'undo_actions_total':
        this.undoActionsTotal.inc(labels);
        break;
      case 'model_recommendation_requests_total':
        this.modelRecommendationRequestsTotal.inc(labels);
        break;
      case 'model_recommendation_events_total':
        this.modelRecommendationEventsTotal.inc(labels);
        break;
      default:
        // Silently ignore unknown counters
        break;
    }
  }

  recordModelRecommendationRequest(mode: string, availability: string): void {
    this.modelRecommendationRequestsTotal.inc({ mode, availability });
  }

  recordModelRecommendationEvent(event: string, mode: string, followed?: boolean): void {
    this.modelRecommendationEventsTotal.inc({
      event,
      mode,
      followed: typeof followed === 'boolean' ? String(followed) : 'unknown',
    });
  }

  recordModelRecommendationTimeToGeneration(durationMs: number, followed?: boolean): void {
    this.modelRecommendationTimeToGeneration.observe({
      followed: typeof followed === 'boolean' ? String(followed) : 'unknown',
    }, durationMs);
  }

  /**
   * Record an LLM API call with latency and status
   */
  recordLLMCall(operation: string, provider: string, durationMs: number, success: boolean): void {
    const status = success ? 'success' : 'error';
    this.llmOperationDuration.observe(
      { operation, provider, status },
      durationMs / 1000
    );
  }

  /**
   * Record LLM token usage per operation and provider
   */
  recordLLMTokens(operation: string, provider: string, inputTokens: number, outputTokens: number): void {
    if (inputTokens > 0) {
      this.llmTokensTotal.inc({ type: 'input', operation, provider }, inputTokens);
    }
    if (outputTokens > 0) {
      this.llmTokensTotal.inc({ type: 'output', operation, provider }, outputTokens);
    }
  }

  /**
   * Record estimated LLM cost in dollars
   */
  recordLLMCost(operation: string, provider: string, costDollars: number): void {
    if (costDollars > 0) {
      this.llmCostDollarsTotal.inc({ operation, provider }, costDollars);
    }
  }

  /**
   * Record a JSON repair event
   */
  recordLLMRepair(operation: string, repairType: string): void {
    this.llmRepairAppliedTotal.inc({ operation, repair_type: repairType });
  }

  /**
   * Record optimization quality gate evaluation.
   * Tracks both the outcome (triggered vs passed) and the score distribution
   * so we can measure how often the iterative retry loop fires.
   */
  recordOptimizationQualityGate(score: number, triggered: boolean): void {
    const outcome = triggered ? 'triggered' : 'passed';
    this.optimizationQualityGateTotal.inc({ outcome });
    this.optimizationQualityGateScore.observe({ outcome }, score);
  }
}

// MetricsService instances should be created via the DI container
// (see server/src/config/services/infrastructure.services.ts)
