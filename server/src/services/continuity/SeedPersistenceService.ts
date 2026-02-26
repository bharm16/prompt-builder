import { logger } from '@infrastructure/Logger';
import type { SeedInfo } from './types';
import type { VideoGenerationResult } from '@services/video-generation/types';

export class SeedPersistenceService {
  private readonly log = logger.child({ service: 'SeedPersistenceService' });

  extractSeed(
    provider: string,
    modelId: string,
    generationResult: Record<string, unknown> | VideoGenerationResult
  ): SeedInfo | null {
    const seed = this.extractSeedFromResult(provider, generationResult as Record<string, unknown>);
    if (seed === null || seed === undefined) {
      this.log.debug('No seed found in generation result', { provider });
      return null;
    }

    return {
      seed,
      provider,
      modelId,
      extractedAt: new Date(),
    };
  }

  buildSeedParam(provider: string, seed?: number): Record<string, unknown> {
    if (seed === undefined) return {};
    const param = this.getSeedParamName(provider);
    return { [param]: seed };
  }

  getInheritedSeed(previousShotSeedInfo: SeedInfo | undefined, currentProvider: string): number | undefined {
    if (!previousShotSeedInfo) return undefined;
    if (previousShotSeedInfo.provider !== currentProvider) {
      return undefined;
    }
    return previousShotSeedInfo.seed;
  }

  private extractSeedFromResult(provider: string, result: Record<string, unknown>): number | null {
    if (typeof result.seed === 'number') return result.seed;
    if (provider === 'replicate') {
      const metrics = result.metrics as Record<string, unknown> | undefined;
      if (metrics && typeof metrics.seed === 'number') return metrics.seed;
    }
    return null;
  }

  private getSeedParamName(provider: string): string {
    switch (provider) {
      case 'replicate':
      case 'runway':
        return 'seed';
      default:
        return 'seed';
    }
  }
}
