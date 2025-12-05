import { logger } from '@infrastructure/Logger.js';
import type { EnhancementMetrics, MetricsService } from './types.js';
import type { PromptMode } from '../constants.js';

interface MetricsParams {
  highlightedCategory: string | null;
  isVideoPrompt: boolean;
  modelTarget: string | null;
  promptSection: string | null;
}

/**
 * EnhancementMetricsService - Handles metrics logging and latency monitoring
 * 
 * Extracted from EnhancementService to follow single responsibility principle.
 * Handles all metrics-related concerns: console logging, metrics service calls,
 * and latency threshold checking.
 */
export class EnhancementMetricsService {
  private readonly metricsService: MetricsService | null;
  private readonly latencyThreshold = 2000; // 2 seconds

  constructor(metricsService: MetricsService | null = null) {
    this.metricsService = metricsService;
  }

  /**
   * Log metrics for enhancement request
   */
  logMetrics(
    metrics: EnhancementMetrics,
    params: MetricsParams,
    error: Error | null = null
  ): void {
    const isDev = process.env.NODE_ENV === 'development';

    // Console logging in development
    if (isDev) {
      this._logToConsole(metrics);
    }

    // Send to metrics service in production
    if (this.metricsService && !isDev) {
      this.metricsService.recordEnhancementTiming(
        this._convertMetricsForService(metrics),
        {
          category: params.highlightedCategory || 'unknown',
          isVideo: params.isVideoPrompt,
          modelTarget: params.modelTarget,
          promptSection: params.promptSection,
          promptMode: metrics.promptMode,
          error: error?.message,
        }
      );
    }

    // Always log to structured logger
    logger.info('Enhancement request completed', {
      ...metrics,
      category: params.highlightedCategory,
      isVideo: params.isVideoPrompt,
      modelTarget: params.modelTarget,
      promptSection: params.promptSection,
      promptMode: metrics.promptMode,
      error: error?.message,
    });
  }

  /**
   * Check if latency threshold was exceeded and alert if necessary
   */
  checkLatency(metrics: EnhancementMetrics): void {
    if (metrics.total > this.latencyThreshold) {
      logger.warn('Enhancement request exceeded latency threshold', {
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

      // Alert in production
      if (process.env.NODE_ENV === 'production' && this.metricsService) {
        this.metricsService.recordAlert('enhancement_latency_exceeded', {
          total: metrics.total,
          threshold: this.latencyThreshold,
        });
      }
    }
  }

  /**
   * Log metrics to console (development only)
   * @private
   */
  private _logToConsole(metrics: EnhancementMetrics): void {
    logger.debug('Enhancement Service Performance', {
      operation: 'logMetrics',
      total: metrics.total,
      promptMode: metrics.promptMode,
      cache: metrics.cache ? 'HIT' : 'MISS',
      cacheCheck: metrics.cacheCheck,
      modelDetection: metrics.modelDetection,
      sectionDetection: metrics.sectionDetection,
      promptBuild: metrics.promptBuild,
      groqCall: metrics.groqCall,
      postProcessing: metrics.postProcessing,
    });
  }

  /**
   * Convert EnhancementMetrics to Record<string, unknown> for metrics service
   * @private
   */
  private _convertMetricsForService(metrics: EnhancementMetrics): Record<string, unknown> {
    return {
      total: metrics.total,
      cache: metrics.cache,
      cacheCheck: metrics.cacheCheck,
      modelDetection: metrics.modelDetection,
      sectionDetection: metrics.sectionDetection,
      promptBuild: metrics.promptBuild,
      groqCall: metrics.groqCall,
      postProcessing: metrics.postProcessing,
      promptMode: metrics.promptMode,
      ...(metrics.usedContrastiveDecoding !== undefined
        ? { usedContrastiveDecoding: metrics.usedContrastiveDecoding }
        : {}),
    };
  }
}

