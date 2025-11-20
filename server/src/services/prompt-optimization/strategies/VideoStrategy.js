import { BaseStrategy } from './BaseStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';
import OptimizationConfig from '../../../config/OptimizationConfig.js';
import { generateVideoPrompt } from './videoPromptOptimizationTemplate.js';

/**
 * Strategy for optimizing video generation prompts
 * Uses specialized video prompt template
 */
export class VideoStrategy extends BaseStrategy {
  constructor(aiService, templateService) {
    super('video', aiService, templateService);
  }

  /**
   * Optimize prompt for video generation
   * Delegates to specialized video prompt template
   * @override
   */
  async optimize({ prompt }) {
    logger.info('Optimizing prompt with video strategy');

    // Generate the system prompt with instructions
    const systemPrompt = generateVideoPrompt(prompt);

    // Call AI service to process the prompt and generate the optimized video prompt
    const config = this.getConfig();
    const response = await this.ai.execute('optimize_standard', {
      systemPrompt,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: config.timeout,
    });

    const optimized = response.content[0].text.trim();

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
  async generateDomainContent() {
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

