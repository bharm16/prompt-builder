/**
 * Metrics Collector Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Focused interface for metrics collection
 * - DIP: Abstraction for metrics operations
 */

export interface IMetricsCollector {
  /**
   * Record successful operation
   */
  recordSuccess(operation: string, duration: number): void;

  /**
   * Record failed operation
   */
  recordFailure(operation: string, duration: number): void;

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string): void;

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string): void;

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(cacheType: string, hitRate: number): void;

  /**
   * Update circuit breaker state (optional)
   */
  updateCircuitBreakerState?(circuit: string, state: 'closed' | 'open' | 'half-open'): void;

  /**
   * Record an LLM API call with latency and status (optional)
   */
  recordLLMCall?(operation: string, provider: string, durationMs: number, success: boolean): void;

  /**
   * Record LLM token usage per operation and provider (optional)
   */
  recordLLMTokens?(operation: string, provider: string, inputTokens: number, outputTokens: number): void;

  /**
   * Record LLM cost in dollars per operation and provider (optional)
   */
  recordLLMCost?(operation: string, provider: string, costDollars: number): void;

  /**
   * Record a JSON repair event (optional)
   */
  recordLLMRepair?(operation: string, repairType: string): void;
}
