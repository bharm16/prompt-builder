import AssetResolverService from '../AssetResolverService';
import { logger } from '@infrastructure/Logger';

export class AssetPromptService {
  private readonly resolver: AssetResolverService;
  private readonly log = logger.child({ service: 'AssetPromptService' });

  constructor(resolver: AssetResolverService) {
    this.resolver = resolver;
  }

  async resolvePrompt(userId: string, rawPrompt: string) {
    const operation = 'resolvePrompt';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      promptLength: rawPrompt.length,
    });

    try {
      const result = await this.resolver.resolvePrompt(userId, rawPrompt);
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetCount: result.assets.length,
        requiresKeyframe: result.requiresKeyframe,
        duration: Math.round(performance.now() - startTime),
      });
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async getSuggestions(userId: string, partialTrigger: string) {
    const operation = 'getSuggestions';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      queryLength: partialTrigger.length,
    });

    try {
      const suggestions = await this.resolver.getSuggestions(userId, partialTrigger);
      this.log.info('Operation completed.', {
        operation,
        userId,
        suggestionCount: suggestions.length,
        duration: Math.round(performance.now() - startTime),
      });
      return suggestions;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async validateTriggers(userId: string, rawPrompt: string) {
    const operation = 'validateTriggers';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      promptLength: rawPrompt.length,
    });

    try {
      const result = await this.resolver.validateTriggers(userId, rawPrompt);
      this.log.info('Operation completed.', {
        operation,
        userId,
        missingCount: result.missingTriggers.length,
        foundCount: result.foundAssets.length,
        duration: Math.round(performance.now() - startTime),
      });
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }
}
