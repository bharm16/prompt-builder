import { logger } from "@infrastructure/Logger";
import type { EnhancementMetrics } from "./types";

interface MetricsParams {
  highlightedCategory: string | null;
  isVideoPrompt: boolean;
  modelTarget: string | null;
  promptSection: string | null;
}

/**
 * EnhancementMetricsService - Handles enhancement-pipeline timing logs
 * and latency-threshold warnings.
 *
 * Production observability now flows through PostHog via
 * SuggestionsTelemetryService; this service only logs structured stage
 * timings to Pino for local debugging and ops triage.
 */
export class EnhancementMetricsService {
  private readonly latencyThreshold = 2000; // 2 seconds

  logMetrics(
    metrics: EnhancementMetrics,
    params: MetricsParams,
    error: Error | null = null,
  ): void {
    if (process.env.NODE_ENV === "development") {
      logger.debug("Enhancement Service Performance", {
        operation: "logMetrics",
        total: metrics.total,
        promptMode: metrics.promptMode,
        cache: metrics.cache ? "HIT" : "MISS",
        cacheCheck: metrics.cacheCheck,
        modelDetection: metrics.modelDetection,
        sectionDetection: metrics.sectionDetection,
        promptBuild: metrics.promptBuild,
        groqCall: metrics.groqCall,
        postProcessing: metrics.postProcessing,
      });
    }

    logger.info("Enhancement request completed", {
      ...metrics,
      category: params.highlightedCategory,
      isVideo: params.isVideoPrompt,
      modelTarget: params.modelTarget,
      promptSection: params.promptSection,
      promptMode: metrics.promptMode,
      error: error?.message,
    });
  }

  checkLatency(metrics: EnhancementMetrics): void {
    if (metrics.total > this.latencyThreshold) {
      logger.warn("Enhancement request exceeded latency threshold", {
        total: metrics.total,
        threshold: this.latencyThreshold,
        breakdown: {
          cacheCheck: metrics.cacheCheck,
          modelDetection: metrics.modelDetection,
          sectionDetection: metrics.sectionDetection,
          promptBuild: metrics.promptBuild,
          groq: metrics.groqCall,
          postProcessing: metrics.postProcessing,
        },
      });
    }
  }
}
