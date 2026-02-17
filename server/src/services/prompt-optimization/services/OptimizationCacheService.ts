import type { CacheService } from '@services/cache/CacheService';
import OptimizationConfig from '@config/OptimizationConfig';
import { OptimizationMode, InferredContext } from '../types';
import crypto from 'crypto';
import { logger } from '@infrastructure/Logger';

export class OptimizationCacheService {
  private readonly cacheConfig: { ttl: number; namespace: string };
  private readonly log = logger.child({ service: 'OptimizationCacheService' });

  constructor(private readonly cacheService: CacheService) {
    this.cacheConfig = this.cacheService.getConfig(OptimizationConfig.cache.promptOptimization);
  }

  async getCachedResult(key: string): Promise<string | null> {
    return this.cacheService.get<string>(key);
  }

  async getCachedMetadata(key: string): Promise<Record<string, unknown> | null> {
    const metaKey = this.buildMetadataCacheKey(key);
    return this.cacheService.get<Record<string, unknown>>(metaKey);
  }

  async cacheResult(key: string, result: string, metadata?: Record<string, unknown> | null): Promise<void> {
    await this.cacheService.set(key, result, this.cacheConfig);
    if (metadata) {
      const metaKey = this.buildMetadataCacheKey(key);
      await this.cacheService.set(metaKey, metadata, this.cacheConfig);
    }
  }

  buildCacheKey(
    prompt: string,
    mode: OptimizationMode,
    context: InferredContext | null,
    brainstormContext: Record<string, unknown> | null,
    targetModel?: string,
    generationParams?: Record<string, unknown> | null,
    lockedSpans?: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>
  ): string {
    const lockedSpanSignature = this.buildLockedSpanSignature(lockedSpans);
    const generationSignature = this.buildGenerationParamsSignature(generationParams);
    const parts = [
      'prompt-opt-v3', // Bump version to clear generic caches and force compilation refresh
      mode,
      targetModel || 'generic',
      prompt.substring(0, 100),
      context ? JSON.stringify(context) : '',
      brainstormContext ? JSON.stringify(brainstormContext) : '',
      generationSignature,
    ];
    if (lockedSpanSignature) {
      parts.push(`locked:${lockedSpanSignature}`);
    }
    return parts.join('::');
  }

  private buildMetadataCacheKey(baseKey: string): string {
    return `${baseKey}::meta`;
  }

  private buildLockedSpanSignature(
    lockedSpans?: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>
  ): string {
    if (!lockedSpans || lockedSpans.length === 0) {
      return '';
    }
    const payload = lockedSpans.map((span) => ({
      text: span.text,
      leftCtx: span.leftCtx ?? null,
      rightCtx: span.rightCtx ?? null,
    }));
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
  }

  private buildGenerationParamsSignature(params?: Record<string, unknown> | null): string {
    if (!params || typeof params !== 'object') {
      return '';
    }
    const sortedEntries = Object.keys(params)
      .sort()
      .map((key) => [key, (params as Record<string, unknown>)[key]]);
    return JSON.stringify(sortedEntries);
  }
}
