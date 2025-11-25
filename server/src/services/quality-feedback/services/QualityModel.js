import { MODEL_CONFIG } from '../config/modelConfig.js';
import { normalizeWeights, sigmoid } from '../utils/statisticsHelpers.js';
import { logger } from '../infrastructure/Logger.ts';

/**
 * Service responsible for managing the machine learning quality model
 */
export class QualityModel {
  constructor() {
    this.baseWeights = { ...MODEL_CONFIG.DEFAULT_WEIGHTS };
    this.baseBias = MODEL_CONFIG.DEFAULT_BIAS;
    this.serviceModels = new Map();
    this.learningRate = MODEL_CONFIG.LEARNING_RATE;
  }

  /**
   * Get model for specific service
   * @param {string} service - Service name
   * @returns {Object} Model with weights and bias
   */
  getModelForService(service) {
    if (this.serviceModels.has(service)) {
      return this.serviceModels.get(service);
    }
    return {
      weights: this.baseWeights,
      bias: this.baseBias,
    };
  }

  /**
   * Calculate prediction using the model
   * @param {Object} features - Feature vector
   * @param {string} service - Service name
   * @returns {number} Predicted quality score (0-1)
   */
  calculatePrediction(features, service) {
    const model = this.getModelForService(service);
    let prediction = model.bias;

    Object.keys(model.weights).forEach(feature => {
      if (features[feature] !== undefined) {
        prediction += model.weights[feature] * features[feature];
      }
    });

    return sigmoid(prediction);
  }

  /**
   * Update the model based on feedback data
   * @param {string} service - Service name
   * @param {Array} feedbackData - Array of feedback entries
   */
  async updateModel(service, feedbackData) {
    if (!feedbackData || feedbackData.length === 0) return;

    logger.info('Updating quality model', { service, dataPoints: feedbackData.length });

    // Get or create service-specific model
    if (!this.serviceModels.has(service)) {
      this.serviceModels.set(service, {
        weights: { ...this.baseWeights },
        bias: this.baseBias,
      });
    }

    const model = this.serviceModels.get(service);

    // Simple gradient descent update
    feedbackData.forEach(entry => {
      const prediction = this._calculateRawPrediction(entry.features, model);
      const error = entry.qualityScore - prediction;

      // Update weights
      Object.keys(model.weights).forEach(feature => {
        if (entry.features[feature] !== undefined) {
          model.weights[feature] += this.learningRate * error * entry.features[feature];
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
   * @private
   */
  _calculateRawPrediction(features, model) {
    let prediction = model.bias;

    Object.keys(model.weights).forEach(feature => {
      if (features[feature] !== undefined) {
        prediction += model.weights[feature] * features[feature];
      }
    });

    return sigmoid(prediction);
  }

  /**
   * Reset model for a service
   * @param {string} service - Service name
   */
  resetModel(service) {
    this.serviceModels.delete(service);
    logger.info('Reset model', { service });
  }

  /**
   * Get model weights for a service
   * @param {string} service - Service name
   * @returns {Object} Model weights
   */
  getWeights(service) {
    return this.getModelForService(service).weights;
  }
}

