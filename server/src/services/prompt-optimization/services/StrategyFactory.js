import { VideoStrategy } from '../strategies/VideoStrategy.js';
import { logger } from '../infrastructure/Logger.ts';

/**
 * Factory for creating optimization strategy instances
 * Implements the Factory pattern for strategy instantiation
 */
export class StrategyFactory {
  constructor(aiService, templateService) {
    this.ai = aiService;
    this.templateService = templateService;
    this.strategies = this.createStrategies();
  }

  /**
   * Create all strategy instances
   * @private
   */
  createStrategies() {
    const strategies = {
      video: new VideoStrategy(this.ai, this.templateService),
    };

    logger.info('Strategy factory initialized', {
      strategies: Object.keys(strategies)
    });

    return strategies;
  }

  /**
   * Get strategy for a specific mode
   * @param {string} mode - The optimization mode (always defaults to video)
   * @returns {VideoStrategy} Strategy instance
   */
  getStrategy(mode) {
    // Always return video strategy (only mode supported)
    const strategy = this.strategies.video;

    if (mode && mode !== 'video') {
      logger.warn('Unknown optimization mode, using video', { mode });
    }

    logger.debug('Strategy selected', { mode: mode || 'video', strategyName: strategy.name });
    return strategy;
  }

  /**
   * Check if a mode is supported
   * @param {string} mode - The mode to check
   * @returns {boolean} True if supported
   */
  hasStrategy(mode) {
    return mode in this.strategies;
  }

  /**
   * Get list of all supported modes
   * @returns {string[]} Array of mode names
   */
  getSupportedModes() {
    return Object.keys(this.strategies);
  }
}

export default StrategyFactory;

