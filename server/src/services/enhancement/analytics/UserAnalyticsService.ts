import { logger } from '@infrastructure/Logger';

interface MetricsService {
  recordCounter: (name: string, labels: Record<string, string>) => void;
}

interface AnalyticsMetadata {
  category?: string;
  modelTarget?: string;
  cacheHit?: boolean;
  contextLayersUsed?: string[];
}

interface SessionMetrics {
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  undoActions: number;
  cacheHits: number;
  cacheMisses: number;
  categoryBreakdown: Record<string, number>;
  modelTargets: Record<string, number>;
}

interface AnalyticsSummary {
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  acceptanceRate: string;
  undoActions: number;
  undoRate: string;
  cacheHitRate: string;
  categoryBreakdown: Record<string, number>;
  modelTargets: Record<string, number>;
}

/**
 * User Analytics Service
 * Tracks user interaction analytics for enhancement suggestions
 * 
 * Metrics tracked:
 * - suggestionAccepted: boolean
 * - timeToDecision: ms (future - requires frontend integration)
 * - undoRate: percentage
 * - contextLayersUsed: array
 * - cacheHit: boolean
 * - categoryType: string
 * - modelTarget: string
 */
export class UserAnalyticsService {
  private readonly metricsService: MetricsService | null;
  private sessionMetrics: SessionMetrics;

  constructor(metricsService: MetricsService | null = null) {
    this.metricsService = metricsService;
    this.sessionMetrics = {
      totalSuggestions: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      undoActions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      categoryBreakdown: {},
      modelTargets: {},
    };
  }

  /**
   * Track suggestion acceptance
   */
  trackSuggestionAccepted(metadata: AnalyticsMetadata = {}): void {
    this.sessionMetrics.totalSuggestions++;
    this.sessionMetrics.acceptedSuggestions++;

    // Track category breakdown
    if (metadata.category) {
      this.sessionMetrics.categoryBreakdown[metadata.category] = 
        (this.sessionMetrics.categoryBreakdown[metadata.category] || 0) + 1;
    }

    // Track model targets
    if (metadata.modelTarget) {
      this.sessionMetrics.modelTargets[metadata.modelTarget] = 
        (this.sessionMetrics.modelTargets[metadata.modelTarget] || 0) + 1;
    }

    // Track cache performance
    if (metadata.cacheHit) {
      this.sessionMetrics.cacheHits++;
    } else {
      this.sessionMetrics.cacheMisses++;
    }

    // Send to metrics service
    if (this.metricsService) {
      this.metricsService.recordCounter('suggestion_accepted_total', {
        category: metadata.category || 'unknown',
        modelTarget: metadata.modelTarget || 'none',
        cacheHit: metadata.cacheHit ? 'true' : 'false',
      });
    }

    logger.debug('Suggestion accepted', {
      category: metadata.category,
      modelTarget: metadata.modelTarget,
      cacheHit: metadata.cacheHit,
      contextLayersUsed: metadata.contextLayersUsed,
    });
  }

  /**
   * Track suggestion rejection
   */
  trackSuggestionRejected(metadata: AnalyticsMetadata = {}): void {
    this.sessionMetrics.totalSuggestions++;
    this.sessionMetrics.rejectedSuggestions++;

    // Send to metrics service
    if (this.metricsService) {
      this.metricsService.recordCounter('suggestion_rejected_total', {
        category: metadata.category || 'unknown',
        modelTarget: metadata.modelTarget || 'none',
      });
    }

    logger.debug('Suggestion rejected', {
      category: metadata.category,
      modelTarget: metadata.modelTarget,
    });
  }

  /**
   * Track undo action
   */
  trackUndo(metadata: AnalyticsMetadata = {}): void {
    this.sessionMetrics.undoActions++;

    // Send to metrics service
    if (this.metricsService) {
      this.metricsService.recordCounter('undo_actions_total', {
        category: metadata.category || 'unknown',
      });
    }

    logger.debug('Undo action', {
      category: metadata.category,
      undoRate: this.getUndoRate(),
    });
  }

  /**
   * Calculate undo rate
   */
  getUndoRate(): string {
    if (this.sessionMetrics.acceptedSuggestions === 0) {
      return '0';
    }
    return (
      (this.sessionMetrics.undoActions / this.sessionMetrics.acceptedSuggestions) * 100
    ).toFixed(2);
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): AnalyticsSummary {
    const summary: AnalyticsSummary = {
      totalSuggestions: this.sessionMetrics.totalSuggestions,
      acceptedSuggestions: this.sessionMetrics.acceptedSuggestions,
      rejectedSuggestions: this.sessionMetrics.rejectedSuggestions,
      acceptanceRate: 
        this.sessionMetrics.totalSuggestions > 0
          ? ((this.sessionMetrics.acceptedSuggestions / this.sessionMetrics.totalSuggestions) * 100).toFixed(2)
          : '0',
      undoActions: this.sessionMetrics.undoActions,
      undoRate: this.getUndoRate(),
      cacheHitRate:
        this.sessionMetrics.totalSuggestions > 0
          ? ((this.sessionMetrics.cacheHits / this.sessionMetrics.totalSuggestions) * 100).toFixed(2)
          : '0',
      categoryBreakdown: this.sessionMetrics.categoryBreakdown,
      modelTargets: this.sessionMetrics.modelTargets,
    };

    logger.info('Analytics summary', { summary });
    return summary;
  }

  /**
   * Reset session metrics
   */
  resetSessionMetrics(): void {
    this.sessionMetrics = {
      totalSuggestions: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      undoActions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      categoryBreakdown: {},
      modelTargets: {},
    };
  }
}
