import { ReasoningStrategy } from '../strategies/ReasoningStrategy.js';
import { ResearchStrategy } from '../strategies/ResearchStrategy.js';
import { SocraticStrategy } from '../strategies/SocraticStrategy.js';
import { VideoStrategy } from '../strategies/VideoStrategy.js';
import { DefaultStrategy } from '../strategies/DefaultStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';

/**
 * Factory for creating optimization strategy instances
 * Implements the Factory pattern for strategy instantiation
 */
export class StrategyFactory {
  constructor(claudeClient, templateService) {
    this.claudeClient = claudeClient;
    this.templateService = templateService;
    this.strategies = this.createStrategies();
  }

  /**
   * Create all strategy instances
   * @private
   */
  createStrategies() {
    const strategies = {
      reasoning: new ReasoningStrategy(this.claudeClient, this.templateService),
      research: new ResearchStrategy(this.claudeClient, this.templateService),
      socratic: new SocraticStrategy(this.claudeClient, this.templateService),
      video: new VideoStrategy(this.claudeClient, this.templateService),
      default: new DefaultStrategy(this.claudeClient, this.templateService),
      optimize: new DefaultStrategy(this.claudeClient, this.templateService), // Alias
    };

    logger.info('Strategy factory initialized', {
      strategies: Object.keys(strategies)
    });

    return strategies;
  }

  /**
   * Get strategy for a specific mode
   * @param {string} mode - The optimization mode
   * @returns {BaseStrategy} Strategy instance
   */
  getStrategy(mode) {
    const strategy = this.strategies[mode];

    if (!strategy) {
      logger.warn('Unknown optimization mode, using default', { mode });
      return this.strategies.default;
    }

    logger.debug('Strategy selected', { mode, strategyName: strategy.name });
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

