/**
 * Temperature Optimizer
 * Dynamically determines optimal temperature settings based on task type
 *
 * Temperature Guidelines:
 * - 0.0-0.3: Factual, deterministic tasks (analysis, classification, structured data)
 * - 0.4-0.7: Balanced tasks (general Q&A, explanations, moderate creativity)
 * - 0.8-1.0: Creative tasks (brainstorming, creative writing, diverse alternatives)
 */
export class TemperatureOptimizer {
  /**
   * Determine optimal temperature for a given task type
   * @param {string} taskType - Type of task
   * @param {Object} options - Additional options
   * @returns {number} Optimal temperature (0.0-1.0)
   */
  static getOptimalTemperature(taskType, options = {}) {
    const { diversity = 'medium', precision = 'medium' } = options;

    // Base temperatures by task type
    const temperatureMap = {
      // Highly deterministic tasks (0.0-0.3)
      classification: 0.1,
      analysis: 0.2,
      'structured-data': 0.1,
      validation: 0.1,
      'scene-detection': 0.2,
      extraction: 0.15,

      // Balanced tasks (0.4-0.6)
      optimization: 0.5,
      'question-generation': 0.6,
      reasoning: 0.4,
      research: 0.5,
      explanation: 0.5,

      // Creative tasks (0.7-1.0)
      'creative-suggestion': 0.8,
      brainstorming: 0.9,
      'video-generation': 0.7,
      enhancement: 0.7,
      socratic: 0.6,
      rewriting: 0.7,
    };

    let baseTemp = temperatureMap[taskType] || 0.5;

    // Adjust based on diversity requirement
    const diversityAdjustment = {
      low: -0.1,
      medium: 0,
      high: 0.1,
      maximum: 0.2,
    };
    baseTemp += diversityAdjustment[diversity] || 0;

    // Adjust based on precision requirement
    const precisionAdjustment = {
      low: 0.1,
      medium: 0,
      high: -0.1,
      maximum: -0.2,
    };
    baseTemp += precisionAdjustment[precision] || 0;

    // Clamp to valid range [0.0, 1.0]
    return Math.max(0.0, Math.min(1.0, baseTemp));
  }

  /**
   * Get temperature configuration with rationale
   * @param {string} taskType - Type of task
   * @param {Object} options - Additional options
   * @returns {Object} Configuration with temperature and explanation
   */
  static getTemperatureConfig(taskType, options = {}) {
    const temperature = this.getOptimalTemperature(taskType, options);
    const rationale = this._getRationale(taskType, temperature);

    return {
      temperature,
      taskType,
      rationale,
      applied: options,
    };
  }

  /**
   * Get rationale for temperature choice
   * @private
   */
  static _getRationale(taskType, temperature) {
    if (temperature <= 0.3) {
      return `Low temperature (${temperature}) for deterministic, factual ${taskType} task requiring consistency and precision`;
    } else if (temperature <= 0.6) {
      return `Moderate temperature (${temperature}) for balanced ${taskType} task requiring both accuracy and some creativity`;
    } else {
      return `High temperature (${temperature}) for creative ${taskType} task requiring diversity and novel ideas`;
    }
  }

  /**
   * Recommend temperature adjustments based on task requirements
   * @param {Object} requirements - Task requirements
   * @returns {Object} Temperature recommendation
   */
  static recommendTemperature(requirements = {}) {
    const {
      needsCreativity = false,
      needsConsistency = false,
      needsDiversity = false,
      needsPrecision = false,
      taskType = 'general',
    } = requirements;

    // Determine diversity and precision levels
    let diversity = 'medium';
    let precision = 'medium';

    if (needsDiversity) diversity = 'high';
    if (needsCreativity) diversity = 'high';
    if (needsConsistency) precision = 'high';
    if (needsPrecision) precision = 'high';

    // Get optimal temperature
    const config = this.getTemperatureConfig(taskType, {
      diversity,
      precision,
    });

    // Add recommendations
    config.recommendations = [];

    if (config.temperature < 0.3) {
      config.recommendations.push(
        'Consider using caching for consistent results across similar requests'
      );
      config.recommendations.push(
        'Expect highly deterministic outputs with minimal variation'
      );
    }

    if (config.temperature > 0.7) {
      config.recommendations.push(
        'Expect high variability in outputs - good for generating options'
      );
      config.recommendations.push(
        'Consider generating multiple samples for broader coverage'
      );
    }

    return config;
  }

  /**
   * Get temperature presets for common scenarios
   * @returns {Object} Named temperature presets
   */
  static getPresets() {
    return {
      // Analysis and extraction
      factExtraction: { temperature: 0.0, description: 'Pure fact extraction' },
      dataClassification: {
        temperature: 0.1,
        description: 'Classification tasks',
      },
      codeGeneration: {
        temperature: 0.2,
        description: 'Deterministic code generation',
      },

      // Balanced tasks
      generalQA: {
        temperature: 0.5,
        description: 'General question answering',
      },
      explanation: { temperature: 0.5, description: 'Explaining concepts' },
      summarization: { temperature: 0.4, description: 'Content summarization' },

      // Creative tasks
      brainstorming: {
        temperature: 0.9,
        description: 'Generating diverse ideas',
      },
      creativeWriting: {
        temperature: 0.8,
        description: 'Creative content generation',
      },
      alternativeGeneration: {
        temperature: 0.7,
        description: 'Multiple creative alternatives',
      },
    };
  }
}
