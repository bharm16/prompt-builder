import { MODEL_CONFIG } from '../config/modelConfig.js';
import { normalizeWeights, sigmoid } from '../utils/statisticsHelpers.js';
import { logger } from '@infrastructure/Logger.js';
import type { FeatureVector, ModelWeights, FeedbackEntry } from '../types.js';

/**
 * Service responsible for managing the machine learning quality model
 */
export class QualityModel {
  private readonly baseWeights: Record<string, number>;
  private readonly baseBias: number;
  private readonly serviceModels: Map<string, ModelWeights>;
  private readonly learningRate: number;

  constructor() {
    this.baseWeights = { ...MODEL_CONFIG.DEFAULT_WEIGHTS };
    this.baseBias = MODEL_CONFIG.DEFAULT_BIAS;
    this.serviceModels = new Map();
    this.learningRate = MODEL_CONFIG.LEARNING_RATE;
  }

  /**
   * Get model for specific service
   */
  getModelForService(service: string): ModelWeights {
    if (this.serviceModels.has(service)) {
      return this.serviceModels.get(service)!;
    }
    return {
      weights: { ...this.baseWeights },
      bias: this.baseBias,
    };
  }

  /**
   * Calculate prediction using the model
   */
  calculatePrediction(features: FeatureVector, service: string): number {
    const model = this.getModelForService(service);
    let prediction = model.bias;

    Object.keys(model.weights).forEach(feature => {
      if (features[feature as keyof FeatureVector] !== undefined) {
        prediction += model.weights[feature] * features[feature as keyof FeatureVector];
      }
    });

    return sigmoid(prediction);
  }

  /**
   * Update the model based on feedback data
   */
  async updateModel(service: string, feedbackData: FeedbackEntry[]): Promise<void> {
    if (!feedbackData || feedbackData.length === 0) return;

    logger.info('Updating quality model', { service, dataPoints: feedbackData.length });

    // Get or create service-specific model
    if (!this.serviceModels.has(service)) {
      this.serviceModels.set(service, {
        weights: { ...this.baseWeights },
        bias: this.baseBias,
      });
    }

    const model = this.serviceModels.get(service)!;

    // Simple gradient descent update
    feedbackData.forEach(entry => {
      const prediction = this._calculateRawPrediction(entry.features, model);
      const error = entry.qualityScore - prediction;

      // Update weights
      Object.keys(model.weights).forEach(feature => {
        if (entry.features[feature as keyof FeatureVector] !== undefined) {
          model.weights[feature] += this.learningRate * error * entry.features[feature as keyof FeatureVector];
        }
      });

      // Update bias
      model.bias += this.learningRate * error;
    });

    // Normalize weights
    model.weights = normalizeWeights(model.weights);

    logger.debug('Model updated', {
      service,
      weights: model.weights,
      dataPoints: feedbackData.length,
    });
  }

  /**
   * Calculate raw prediction without sigmoid
   */
  private _calculateRawPrediction(features: FeatureVector, model: ModelWeights): number {
    let prediction = model.bias;

    Object.keys(model.weights).forEach(feature => {
      if (features[feature as keyof FeatureVector] !== undefined) {
        prediction += model.weights[feature] * features[feature as keyof FeatureVector];
      }
    });

    return sigmoid(prediction);
  }

  /**
   * Reset model for a service
   */
  resetModel(service: string): void {
    this.serviceModels.delete(service);
    logger.info('Reset model', { service });
  }

  /**
   * Get model weights for a service
   */
  getWeights(service: string): Record<string, number> {
    return this.getModelForService(service).weights;
  }
}

