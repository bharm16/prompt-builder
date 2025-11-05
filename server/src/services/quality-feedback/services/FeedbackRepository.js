import { MODEL_CONFIG } from '../config/modelConfig.js';
import { calculateAverage, calculateTrend } from '../utils/statisticsHelpers.js';

/**
 * Service responsible for storing and retrieving feedback data
 */
export class FeedbackRepository {
  constructor() {
    this.storage = new Map();
    this.maxEntriesPerService = MODEL_CONFIG.MAX_FEEDBACK_PER_SERVICE;
    this.minDataPoints = MODEL_CONFIG.MIN_DATA_POINTS;
  }

  /**
   * Store a feedback entry
   * @param {Object} entry - Feedback entry to store
   */
  store(entry) {
    const service = entry.service || 'default';

    if (!this.storage.has(service)) {
      this.storage.set(service, []);
    }

    const serviceData = this.storage.get(service);
    serviceData.push(entry);

    // Limit storage per service (FIFO)
    if (serviceData.length > this.maxEntriesPerService) {
      serviceData.shift(); // Remove oldest
    }
  }

  /**
   * Get all feedback for a service
   * @param {string} service - Service name
   * @returns {Array} Feedback entries
   */
  getAll(service) {
    return this.storage.get(service) || [];
  }

  /**
   * Check if enough data is available for model update
   * @param {string} service - Service name
   * @returns {boolean}
   */
  hasEnoughData(service) {
    const data = this.getAll(service);
    return data.length >= this.minDataPoints;
  }

  /**
   * Get quality statistics for a service
   * @param {string} service - Service name
   * @returns {Object} Statistics
   */
  getStatistics(service) {
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
    
    let trend = 'stable';
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
   * @param {string} service - Service name
   */
  clear(service) {
    this.storage.delete(service);
  }

  /**
   * Get recent feedback entries
   * @param {string} service - Service name
   * @param {number} count - Number of entries to retrieve
   * @returns {Array} Recent feedback entries
   */
  getRecent(service, count = 20) {
    const data = this.getAll(service);
    return data.slice(-count);
  }
}

