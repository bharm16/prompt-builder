import { VideoStrategy } from '../strategies/VideoStrategy.js';
import { logger } from '@infrastructure/Logger.js';
import type { AIService, TemplateService, OptimizationStrategy, OptimizationMode } from '../types.js';

/**
 * Factory for creating optimization strategy instances
 * Implements the Factory pattern for strategy instantiation
 */
export class StrategyFactory {
  private readonly ai: AIService;
  private readonly templateService: TemplateService;
  private readonly strategies: Record<string, OptimizationStrategy>;

  constructor(aiService: AIService, templateService: TemplateService) {
    this.ai = aiService;
    this.templateService = templateService;
    this.strategies = this.createStrategies();
  }

  /**
   * Create all strategy instances
   */
  private createStrategies(): Record<string, OptimizationStrategy> {
    const strategies: Record<string, OptimizationStrategy> = {
      video: new VideoStrategy(this.ai, this.templateService),
    };

    logger.info('Strategy factory initialized', {
      strategies: Object.keys(strategies)
    });

    return strategies;
  }

  /**
   * Get strategy for a specific mode
   */
  getStrategy(mode?: OptimizationMode): OptimizationStrategy {
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
   */
  hasStrategy(mode: OptimizationMode): boolean {
    return mode in this.strategies;
  }

  /**
   * Get list of all supported modes
   */
  getSupportedModes(): string[] {
    return Object.keys(this.strategies);
  }
}

export default StrategyFactory;

