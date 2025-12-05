import { logger } from '@infrastructure/Logger';
import { MODEL_CONFIG } from '../config/modelConfig.js';
import { calculateAverage, calculateTrend } from '../utils/statisticsHelpers.js';
import type { FeedbackEntry, QualityStatistics } from '../types.js';

/**
 * Service responsible for storing and retrieving feedback data
 */
export class FeedbackRepository {
  private readonly storage: Map<string, FeedbackEntry[]>;
  private readonly maxEntriesPerService: number;
  private readonly minDataPoints: number;
  private readonly log = logger.child({ service: 'FeedbackRepository' });

  constructor() {
    this.storage = new Map();
    this.maxEntriesPerService = MODEL_CONFIG.MAX_FEEDBACK_PER_SERVICE;
    this.minDataPoints = MODEL_CONFIG.MIN_DATA_POINTS;
  }

  /**
   * Store a feedback entry
   */
  store(entry: FeedbackEntry): void {
    const operation = 'store';
    const service = entry.service || 'default';

    this.log.debug('Storing feedback entry', {
      operation,
      service,
    });

    if (!this.storage.has(service)) {
      this.storage.set(service, []);
    }

    const serviceData = this.storage.get(service)!;
    serviceData.push(entry);

    // Limit storage per service (FIFO)
    if (serviceData.length > this.maxEntriesPerService) {
      serviceData.shift(); // Remove oldest
      this.log.debug('Removed oldest feedback entry (FIFO)', {
        operation,
        service,
        currentCount: serviceData.length,
      });
    }
    
    this.log.info('Feedback entry stored', {
      operation,
      service,
      totalEntries: serviceData.length,
    });
  }

  /**
   * Get all feedback for a service
   */
  getAll(service: string): FeedbackEntry[] {
    return this.storage.get(service) || [];
  }

  /**
   * Check if enough data is available for model update
   */
  hasEnoughData(service: string): boolean {
    const data = this.getAll(service);
    return data.length >= this.minDataPoints;
  }

  /**
   * Get quality statistics for a service
   */
  getStatistics(service: string): QualityStatistics {
    const serviceData = this.getAll(service);

    if (serviceData.length === 0) {
      return {
        totalFeedback: 0,
        acceptanceRate: 0,
        averageQuality: 0,
        recentTrend: 'stable',
      };
    }

    // Calculate basic metrics
    const acceptedCount = serviceData.filter(entry => entry.accepted).length;
    const qualityScores = serviceData.map(entry => entry.qualityScore);
    const averageQuality = calculateAverage(qualityScores);

    // Calculate trend (last 20 vs previous 20)
    const recentScores = serviceData.slice(-20).map(e => e.qualityScore);
    const previousScores = serviceData.slice(-40, -20).map(e => e.qualityScore);
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentScores.length >= 10 && previousScores.length >= 10) {
      trend = calculateTrend(recentScores, previousScores);
    }

    return {
      totalFeedback: serviceData.length,
      acceptanceRate: acceptedCount / serviceData.length,
      averageQuality,
      recentTrend: trend,
    };
  }

  /**
   * Clear all feedback for a service
   */
  clear(service: string): void {
    this.storage.delete(service);
  }

  /**
   * Get recent feedback entries
   */
  getRecent(service: string, count: number = 20): FeedbackEntry[] {
    const data = this.getAll(service);
    return data.slice(-count);
  }
}

