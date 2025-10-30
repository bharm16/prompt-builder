import { BaseStrategy } from './BaseStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';
import OptimizationConfig from '../../../config/OptimizationConfig.js';
import { generateVideoPrompt } from '../../VideoPromptTemplates.js';

/**
 * Strategy for optimizing video generation prompts
 * Uses specialized video prompt template
 */
export class VideoStrategy extends BaseStrategy {
  constructor(claudeClient, templateService) {
    super('video', claudeClient, templateService);
  }

  /**
   * Optimize prompt for video generation
   * Delegates to specialized video prompt template
   * @override
   */
  async optimize({ prompt }) {
    logger.info('Optimizing prompt with video strategy');

    // Use existing video prompt template generator
    const optimized = generateVideoPrompt(prompt);

    logger.info('Video optimization complete', {
      originalLength: prompt.length,
      optimizedLength: optimized.length
    });

    return optimized;
  }

  /**
   * Video mode does not generate domain content
   * @override
   */
  async generateDomainContent(prompt, context) {
    return null;
  }

  /**
   * Get configuration for video strategy
   * @override
   */
  getConfig() {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.video,
      temperature: OptimizationConfig.temperatures.optimization.video,
      timeout: OptimizationConfig.timeouts.optimization.video,
    };
  }
}

export default VideoStrategy;
