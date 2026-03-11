import type { CacheService } from '@services/cache/CacheService';
import OptimizationConfig from '@config/OptimizationConfig';
import type { LockedSpan, ShotPlan, StructuredOptimizationArtifact } from '../types';
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

  async getStructuredArtifact(key: string): Promise<StructuredOptimizationArtifact | null> {
    return this.cacheService.get<StructuredOptimizationArtifact>(key);
  }

  async cacheResult(key: string, result: string, metadata?: Record<string, unknown> | null): Promise<void> {
    await this.cacheService.set(key, result, this.cacheConfig);
    if (metadata) {
      const metaKey = this.buildMetadataCacheKey(key);
      await this.cacheService.set(metaKey, metadata, this.cacheConfig);
    }
  }

  async cacheStructuredArtifact(
    key: string,
    artifact: StructuredOptimizationArtifact
  ): Promise<void> {
    await this.cacheService.set(key, artifact, this.cacheConfig);
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
      'prompt-opt-v4',
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

  buildStructuredArtifactKey(genericPrompt: string): string {
    return this.buildStructuredArtifactKeyFromInputs({
      prompt: genericPrompt,
      sourcePrompt: genericPrompt,
    });
  }

  buildStructuredArtifactKeyFromInputs(params: {
    prompt: string;
    sourcePrompt?: string | null;
    shotPlan?: ShotPlan | null;
    generationParams?: Record<string, unknown> | null;
    lockedSpans?: LockedSpan[];
  }): string {
    const normalizedPayload = {
      prompt: params.prompt.trim(),
      sourcePrompt: params.sourcePrompt?.trim() ?? '',
      shotPlan: params.shotPlan ? this.normalizeShotPlan(params.shotPlan) : null,
      generationParams: this.normalizeGenerationParams(params.generationParams),
      lockedSpans: this.normalizeLockedSpans(params.lockedSpans),
    };
    const promptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(normalizedPayload))
      .digest('hex')
      .substring(0, 24);

    return ['prompt-opt-v5', 'structured-artifact', promptHash].join('::');
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

  private normalizeShotPlan(shotPlan: ShotPlan): Record<string, unknown> {
    return Object.keys(shotPlan)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (shotPlan as unknown as Record<string, unknown>)[key];
        return acc;
      }, {});
  }

  private normalizeGenerationParams(
    params?: Record<string, unknown> | null
  ): Array<[string, unknown]> {
    if (!params || typeof params !== 'object') {
      return [];
    }

    return Object.keys(params)
      .sort()
      .map((key) => [key, params[key]]);
  }

  private normalizeLockedSpans(lockedSpans?: LockedSpan[]): Array<Record<string, unknown>> {
    if (!lockedSpans || lockedSpans.length === 0) {
      return [];
    }

    return lockedSpans.map((span) => ({
      text: span.text,
      leftCtx: span.leftCtx ?? null,
      rightCtx: span.rightCtx ?? null,
      category: span.category ?? null,
      source: span.source ?? null,
      confidence: span.confidence ?? null,
    }));
  }
}
