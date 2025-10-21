import { logger } from '../infrastructure/Logger.js';

/**
 * Quality feedback system for tracking and learning from suggestion quality
 * Improves suggestions over time based on user acceptance patterns
 */
export class QualityFeedbackSystem {
  constructor() {
    this.feedbackDatabase = new Map();
    this.qualityModel = this.initializeModel();
    this.featureExtractor = this.initializeFeatureExtractor();
    this.learningRate = 0.1;
    this.minDataPoints = 10;
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
    const features = await this.extractFeatures(suggestion, context);

    // Calculate quality score
    const qualityScore = await this.assessFinalQuality(finalOutput, context);

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

    this.storeFeedback(feedbackEntry);

    // Update model if we have enough data
    if (await this.hasEnoughData(service)) {
      await this.updateQualityModel(service);
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
    const features = await this.extractFeatures(suggestion, context);

    // Get service-specific model or use default
    const model = this.getModelForService(service);

    // Calculate prediction
    const prediction = this.calculatePrediction(features, model);

    logger.debug('Quality prediction', {
      service,
      prediction,
      featureCount: Object.keys(features).length,
    });

    return prediction;
  }

  /**
   * Initialize the quality model
   * @private
   */
  initializeModel() {
    return {
      weights: {
        length: 0.1,
        specificity: 0.25,
        clarity: 0.2,
        actionability: 0.25,
        contextMatch: 0.2,
      },
      bias: 0.5,
      serviceModels: new Map(),
    };
  }

  /**
   * Initialize feature extractor
   * @private
   */
  initializeFeatureExtractor() {
    return {
      extractLength: (text) => Math.min(text.length / 200, 1),
      extractSpecificity: (text) => this.calculateSpecificity(text),
      extractClarity: (text) => this.calculateClarity(text),
      extractActionability: (text) => this.calculateActionability(text),
      extractContextMatch: (text, context) => this.calculateContextMatch(text, context),
    };
  }

  /**
   * Extract features from a suggestion
   * @private
   */
  async extractFeatures(suggestion, context) {
    const text = typeof suggestion === 'string' ? suggestion : suggestion.text || '';

    const features = {
      length: this.featureExtractor.extractLength(text),
      specificity: this.featureExtractor.extractSpecificity(text),
      clarity: this.featureExtractor.extractClarity(text),
      actionability: this.featureExtractor.extractActionability(text),
      contextMatch: this.featureExtractor.extractContextMatch(text, context),
      // Additional features
      hasExamples: text.includes('example') || text.includes('e.g.') ? 1 : 0,
      hasNumbers: /\d+/.test(text) ? 1 : 0,
      hasStructure: text.includes('\n') || text.includes('•') || text.includes('-') ? 1 : 0,
      sentenceCount: (text.match(/[.!?]+/g) || []).length / 10,
      questionCount: (text.match(/\?/g) || []).length / 5,
    };

    return features;
  }

  /**
   * Calculate specificity score
   * @private
   */
  calculateSpecificity(text) {
    const specificTerms = [
      'specifically', 'exactly', 'precisely', 'particular',
      'must', 'require', 'ensure', 'define', 'implement',
    ];

    let score = 0;
    const textLower = text.toLowerCase();

    specificTerms.forEach(term => {
      if (textLower.includes(term)) score += 0.15;
    });

    // Check for concrete nouns and technical terms
    const technicalPattern = /\b[A-Z][a-z]+[A-Z]\w*\b/g; // CamelCase
    const technicalMatches = text.match(technicalPattern) || [];
    score += technicalMatches.length * 0.1;

    return Math.min(score, 1);
  }

  /**
   * Calculate clarity score
   * @private
   */
  calculateClarity(text) {
    let score = 0.5; // Base score

    // Positive indicators
    if (text.length > 20 && text.length < 500) score += 0.2;
    if (text.includes(':') || text.includes('-')) score += 0.1; // Structure
    if (!/\b(thing|stuff|whatever)\b/i.test(text)) score += 0.1; // No vague words

    // Negative indicators
    const avgWordLength = text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) /
                         (text.split(/\s+/).length || 1);
    if (avgWordLength > 10) score -= 0.1; // Too complex

    // Check sentence structure
    const sentences = text.split(/[.!?]+/);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) /
                              (sentences.length || 1);
    if (avgSentenceLength < 100) score += 0.1; // Good sentence length

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate actionability score
   * @private
   */
  calculateActionability(text) {
    const actionWords = [
      'create', 'implement', 'build', 'design', 'develop',
      'write', 'add', 'update', 'modify', 'configure',
      'analyze', 'evaluate', 'optimize', 'test', 'deploy',
    ];

    let score = 0;
    const textLower = text.toLowerCase();

    actionWords.forEach(word => {
      if (textLower.includes(word)) score += 0.1;
    });

    // Check for imperative mood (starts with verb)
    const firstWord = text.trim().split(/\s+/)[0].toLowerCase();
    if (actionWords.includes(firstWord)) score += 0.2;

    // Check for clear steps or instructions
    if (text.includes('1.') || text.includes('first')) score += 0.15;
    if (text.includes('then') || text.includes('next')) score += 0.15;

    return Math.min(score, 1);
  }

  /**
   * Calculate context match score
   * @private
   */
  calculateContextMatch(text, context) {
    if (!context) return 0.5;

    let score = 0;
    const textLower = text.toLowerCase();

    // Check if key context terms appear in the suggestion
    if (context.domain) {
      const domainTerms = this.getDomainTerms(context.domain);
      domainTerms.forEach(term => {
        if (textLower.includes(term)) score += 0.1;
      });
    }

    // Check if suggestion addresses the context type
    if (context.type) {
      if (context.type === 'technical' && /\b(code|api|function)\b/i.test(text)) {
        score += 0.2;
      }
      if (context.type === 'creative' && /\b(design|create|imagine)\b/i.test(text)) {
        score += 0.2;
      }
    }

    // Check length appropriateness for context
    if (context.expectedLength) {
      const lengthRatio = text.length / context.expectedLength;
      if (lengthRatio > 0.7 && lengthRatio < 1.5) score += 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * Get domain-specific terms
   * @private
   */
  getDomainTerms(domain) {
    const terms = {
      technical: ['code', 'function', 'api', 'database', 'algorithm', 'debug'],
      creative: ['story', 'character', 'plot', 'narrative', 'theme', 'style'],
      analytical: ['data', 'analysis', 'metrics', 'statistics', 'trend', 'pattern'],
      educational: ['learn', 'understand', 'concept', 'example', 'explain', 'practice'],
    };

    return terms[domain] || [];
  }

  /**
   * Assess the final quality of output
   * @private
   */
  async assessFinalQuality(finalOutput, context) {
    if (!finalOutput) return 0.5;

    // Basic quality metrics
    const metrics = {
      completeness: this.assessCompleteness(finalOutput, context),
      correctness: this.assessCorrectness(finalOutput, context),
      usefulness: this.assessUsefulness(finalOutput, context),
      efficiency: this.assessEfficiency(finalOutput, context),
    };

    // Weight the metrics
    const qualityScore =
      metrics.completeness * 0.3 +
      metrics.correctness * 0.3 +
      metrics.usefulness * 0.25 +
      metrics.efficiency * 0.15;

    return Math.min(Math.max(qualityScore, 0), 1);
  }

  /**
   * Assess completeness of output
   * @private
   */
  assessCompleteness(output, context) {
    let score = 0.5;

    // Check if output meets minimum length expectations
    if (output.length > 50) score += 0.2;

    // Check if it has structure
    if (output.includes('\n') || output.includes('. ')) score += 0.15;

    // Check if it addresses multiple aspects
    const aspects = ['what', 'why', 'how', 'when', 'where'];
    aspects.forEach(aspect => {
      if (output.toLowerCase().includes(aspect)) score += 0.05;
    });

    return Math.min(score, 1);
  }

  /**
   * Assess correctness of output
   * @private
   */
  assessCorrectness(output, context) {
    // This is a simplified heuristic
    // In a real system, this might involve more sophisticated checks

    let score = 0.7; // Assume mostly correct by default

    // Check for common error indicators
    const errorIndicators = ['error', 'failed', 'undefined', 'null', 'exception'];
    errorIndicators.forEach(indicator => {
      if (output.toLowerCase().includes(indicator)) score -= 0.1;
    });

    // Check for success indicators
    const successIndicators = ['success', 'complete', 'done', 'working', 'fixed'];
    successIndicators.forEach(indicator => {
      if (output.toLowerCase().includes(indicator)) score += 0.05;
    });

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Assess usefulness of output
   * @private
   */
  assessUsefulness(output, context) {
    let score = 0.5;

    // Check for practical elements
    if (output.includes('example') || output.includes('e.g.')) score += 0.15;
    if (/\d+/.test(output)) score += 0.1; // Contains numbers/data
    if (output.includes('step') || output.includes('instruction')) score += 0.15;

    // Check if it provides value beyond restating
    const uniqueWords = new Set(output.toLowerCase().split(/\s+/));
    if (uniqueWords.size > 20) score += 0.1; // Reasonable vocabulary

    return Math.min(score, 1);
  }

  /**
   * Assess efficiency of output
   * @private
   */
  assessEfficiency(output, context) {
    // Efficiency: not too verbose, but complete

    const words = output.split(/\s+/).length;
    const sentences = (output.match(/[.!?]+/g) || []).length;

    // Ideal: 10-30 words per sentence
    const wordsPerSentence = words / (sentences || 1);
    let score = 0.5;

    if (wordsPerSentence >= 10 && wordsPerSentence <= 30) score += 0.3;
    if (words >= 20 && words <= 500) score += 0.2; // Good overall length

    return Math.min(score, 1);
  }

  /**
   * Store feedback in the database
   * @private
   */
  storeFeedback(feedbackEntry) {
    const service = feedbackEntry.service || 'default';

    if (!this.feedbackDatabase.has(service)) {
      this.feedbackDatabase.set(service, []);
    }

    const serviceData = this.feedbackDatabase.get(service);
    serviceData.push(feedbackEntry);

    // Limit storage per service
    if (serviceData.length > 1000) {
      serviceData.shift(); // Remove oldest
    }
  }

  /**
   * Check if we have enough data for model update
   * @private
   */
  async hasEnoughData(service) {
    const serviceData = this.feedbackDatabase.get(service) || [];
    return serviceData.length >= this.minDataPoints;
  }

  /**
   * Update the quality model based on feedback
   * @private
   */
  async updateQualityModel(service) {
    logger.info('Updating quality model', { service });

    const serviceData = this.feedbackDatabase.get(service) || [];
    if (serviceData.length === 0) return;

    // Get or create service-specific model
    if (!this.qualityModel.serviceModels.has(service)) {
      this.qualityModel.serviceModels.set(service, {
        weights: { ...this.qualityModel.weights },
        bias: this.qualityModel.bias,
      });
    }

    const model = this.qualityModel.serviceModels.get(service);

    // Simple gradient descent update
    serviceData.forEach(entry => {
      const prediction = this.calculatePrediction(entry.features, model);
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
    const totalWeight = Object.values(model.weights).reduce((a, b) => a + Math.abs(b), 0);
    if (totalWeight > 0) {
      Object.keys(model.weights).forEach(feature => {
        model.weights[feature] /= totalWeight;
      });
    }

    logger.debug('Model updated', {
      service,
      weights: model.weights,
      dataPoints: serviceData.length,
    });
  }

  /**
   * Calculate prediction using the model
   * @private
   */
  calculatePrediction(features, model) {
    let prediction = model.bias;

    Object.keys(model.weights).forEach(feature => {
      if (features[feature] !== undefined) {
        prediction += model.weights[feature] * features[feature];
      }
    });

    // Sigmoid activation
    return 1 / (1 + Math.exp(-prediction));
  }

  /**
   * Get model for specific service
   * @private
   */
  getModelForService(service) {
    if (this.qualityModel.serviceModels.has(service)) {
      return this.qualityModel.serviceModels.get(service);
    }
    return {
      weights: this.qualityModel.weights,
      bias: this.qualityModel.bias,
    };
  }

  /**
   * Get quality statistics for a service
   * @param {string} service - Service name
   * @returns {Object} Quality statistics
   */
  getQualityStatistics(service) {
    const serviceData = this.feedbackDatabase.get(service) || [];

    if (serviceData.length === 0) {
      return {
        totalFeedback: 0,
        acceptanceRate: 0,
        averageQuality: 0,
        recentTrend: 'stable',
      };
    }

    const acceptedCount = serviceData.filter(entry => entry.accepted).length;
    const totalQuality = serviceData.reduce((sum, entry) => sum + entry.qualityScore, 0);

    // Calculate recent trend (last 20 vs previous 20)
    const recent = serviceData.slice(-20);
    const previous = serviceData.slice(-40, -20);

    let trend = 'stable';
    if (recent.length >= 10 && previous.length >= 10) {
      const recentAvg = recent.reduce((sum, e) => sum + e.qualityScore, 0) / recent.length;
      const previousAvg = previous.reduce((sum, e) => sum + e.qualityScore, 0) / previous.length;

      if (recentAvg > previousAvg + 0.05) trend = 'improving';
      else if (recentAvg < previousAvg - 0.05) trend = 'declining';
    }

    return {
      totalFeedback: serviceData.length,
      acceptanceRate: acceptedCount / serviceData.length,
      averageQuality: totalQuality / serviceData.length,
      recentTrend: trend,
      modelWeights: this.getModelForService(service).weights,
    };
  }

  /**
   * Reset learning for a service
   * @param {string} service - Service name
   */
  resetLearning(service) {
    this.feedbackDatabase.delete(service);
    this.qualityModel.serviceModels.delete(service);
    logger.info('Reset learning', { service });
  }
}

// Export singleton instance
export const qualityFeedbackSystem = new QualityFeedbackSystem();