import { logger } from '../../infrastructure/Logger.ts';
import { FeatureExtractor } from './services/FeatureExtractor.js';
import { QualityAssessor } from './services/QualityAssessor.js';
import { QualityModel } from './services/QualityModel.js';
import { FeedbackRepository } from './services/FeedbackRepository.js';

/**
 * Main orchestrator for quality feedback system
 * Coordinates feature extraction, quality assessment, and model updates
 */
export class QualityFeedbackService {
  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.qualityAssessor = new QualityAssessor();
    this.qualityModel = new QualityModel();
    this.feedbackRepository = new FeedbackRepository();
  }

  /**
   * Track the quality of a suggestion
   * @param {Object} params - Tracking parameters
   * @returns {Promise<void>}
   */
  async trackSuggestionQuality({
    suggestionId,
    suggestion,
    wasAccepted,
    finalOutput,
    context,
    service,
  }) {
    logger.info('Tracking suggestion quality', {
      suggestionId,
      accepted: wasAccepted,
      service,
    });

    // Extract features from the suggestion
    const features = await this.featureExtractor.extractFeatures(suggestion, context);

    // Calculate quality score
    const qualityScore = await this.qualityAssessor.assessFinalQuality(finalOutput, context);

    // Store feedback data
    const feedbackEntry = {
      id: suggestionId,
      suggestion,
      features,
      accepted: wasAccepted,
      qualityScore,
      context,
      service,
      timestamp: Date.now(),
    };

    this.feedbackRepository.store(feedbackEntry);

    // Update model if we have enough data
    if (this.feedbackRepository.hasEnoughData(service)) {
      const feedbackData = this.feedbackRepository.getAll(service);
      await this.qualityModel.updateModel(service, feedbackData);
    }

    logger.debug('Quality tracked', {
      suggestionId,
      score: qualityScore,
      features: Object.keys(features).length,
    });
  }

  /**
   * Predict the quality of a suggestion
   * @param {string} suggestion - The suggestion text
   * @param {Object} context - Context information
   * @param {string} service - Service name
   * @returns {Promise<number>} Predicted quality score (0-1)
   */
  async predictSuggestionQuality(suggestion, context, service) {
    // Extract features
    const features = await this.featureExtractor.extractFeatures(suggestion, context);

    // Calculate prediction
    const prediction = this.qualityModel.calculatePrediction(features, service);

    logger.debug('Quality prediction', {
      service,
      prediction,
      featureCount: Object.keys(features).length,
    });

    return prediction;
  }

  /**
   * Get quality statistics for a service
   * @param {string} service - Service name
   * @returns {Object} Quality statistics
   */
  getQualityStatistics(service) {
    const stats = this.feedbackRepository.getStatistics(service);
    const modelWeights = this.qualityModel.getWeights(service);

    return {
      ...stats,
      modelWeights,
    };
  }

  /**
   * Reset learning for a service
   * @param {string} service - Service name
   */
  resetLearning(service) {
    this.feedbackRepository.clear(service);
    this.qualityModel.resetModel(service);
    logger.info('Reset learning', { service });
  }
}

// Export singleton instance
export const qualityFeedbackService = new QualityFeedbackService();

