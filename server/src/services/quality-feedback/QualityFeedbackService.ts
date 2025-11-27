import { logger } from '@infrastructure/Logger.js';
import { FeatureExtractor } from './services/FeatureExtractor.js';
import { QualityAssessor } from './services/QualityAssessor.js';
import { QualityModel } from './services/QualityModel.js';
import { FeedbackRepository } from './services/FeedbackRepository.js';
import type { FeatureContext, QualityStatistics, FeedbackEntry } from './types.js';

interface TrackingParams {
  suggestionId: string;
  suggestion: string | { text: string };
  wasAccepted: boolean;
  finalOutput: string;
  context?: FeatureContext;
  service: string;
}

/**
 * Main orchestrator for quality feedback system
 * Coordinates feature extraction, quality assessment, and model updates
 */
export class QualityFeedbackService {
  private readonly featureExtractor: FeatureExtractor;
  private readonly qualityAssessor: QualityAssessor;
  private readonly qualityModel: QualityModel;
  private readonly feedbackRepository: FeedbackRepository;

  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.qualityAssessor = new QualityAssessor();
    this.qualityModel = new QualityModel();
    this.feedbackRepository = new FeedbackRepository();
  }

  /**
   * Track the quality of a suggestion
   */
  async trackSuggestionQuality({
    suggestionId,
    suggestion,
    wasAccepted,
    finalOutput,
    context,
    service,
  }: TrackingParams): Promise<void> {
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
    const feedbackEntry: FeedbackEntry = {
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
   */
  async predictSuggestionQuality(
    suggestion: string | { text: string },
    context: FeatureContext | null | undefined,
    service: string
  ): Promise<number> {
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
   */
  getQualityStatistics(service: string): QualityStatistics {
    const stats = this.feedbackRepository.getStatistics(service);
    const modelWeights = this.qualityModel.getWeights(service);

    return {
      ...stats,
      modelWeights,
    };
  }

  /**
   * Reset learning for a service
   */
  resetLearning(service: string): void {
    this.feedbackRepository.clear(service);
    this.qualityModel.resetModel(service);
    logger.info('Reset learning', { service });
  }
}

// Export singleton instance
export const qualityFeedbackService = new QualityFeedbackService();

