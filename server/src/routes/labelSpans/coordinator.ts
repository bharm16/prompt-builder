import { createHash } from 'crypto';
import { logger } from '@infrastructure/Logger';
import { labelSpans } from '@llm/span-labeling/SpanLabelingService';
import { getCurrentSpanProvider } from '@llm/span-labeling/services/LlmClientFactory';
import { spanLabelingCache } from '@services/cache/SpanLabelingCacheService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { LabelSpansParams, LabelSpansResult, ValidationPolicy } from '@llm/span-labeling/types';

interface LabelSpansCoordinatorInput {
  payload: LabelSpansParams;
  text: string;
  policy?: ValidationPolicy | null;
  templateVersion?: string | null;
  requestId?: string;
  userId?: string;
  startTimeMs: number;
}

export interface LabelSpansCoordinatorResult {
  result: LabelSpansResult | null;
  headers: Record<string, string>;
}

const createCoalescingKey = (
  text: string,
  policy: ValidationPolicy | null,
  templateVersion: string | null
): string => {
  const textHash = createHash('sha256')
    .update(text)
    .digest('hex')
    .substring(0, 16);

  const policyHash = createHash('sha256')
    .update(
      JSON.stringify({
        policy: policy || {},
        templateVersion: templateVersion || 'v1',
      })
    )
    .digest('hex')
    .substring(0, 8);

  return `span:${textHash}:${policyHash}`;
};

export function createLabelSpansCoordinator(aiService: AIModelService): {
  resolve: (input: LabelSpansCoordinatorInput) => Promise<LabelSpansCoordinatorResult>;
} {
  const inflightRequests = new Map<string, Promise<LabelSpansResult>>();

  return {
    async resolve({
      payload,
      text,
      policy,
      templateVersion,
      requestId,
      userId,
      startTimeMs,
    }: LabelSpansCoordinatorInput): Promise<LabelSpansCoordinatorResult> {
      const headers: Record<string, string> = {};
      const operation = 'labelSpans';
      const cachePolicy = policy ?? null;
      const cacheTemplateVersion = templateVersion ?? null;

      // Cache-aside pattern: Check cache first
      let result: LabelSpansResult | null = null;

      if (spanLabelingCache) {
        const cacheStartTime = performance.now();
        const cacheProvider = getCurrentSpanProvider();
        const cached = (await spanLabelingCache.get(
          text,
          cachePolicy,
          cacheTemplateVersion,
          cacheProvider
        )) as LabelSpansResult | null;

        if (cached) {
          result = cached;

          const cacheTime = Math.round(performance.now() - cacheStartTime);
          logger.debug('Span labeling cache hit', {
            operation,
            requestId,
            userId,
            cacheTime,
            textLength: text.length,
            spanCount: cached.spans.length,
            duration: Math.round(performance.now() - startTimeMs),
          });

          headers['X-Cache'] = 'HIT';
          headers['X-Cache-Time'] = `${cacheTime}ms`;
        }
      }

      if (!result) {
        const coalescingKey = createCoalescingKey(
          text,
          cachePolicy,
          cacheTemplateVersion
        );
        const inflight = inflightRequests.get(coalescingKey);

        if (inflight) {
          const coalescedStart = performance.now();
          result = await inflight;

          const coalescedTime = Math.round(performance.now() - coalescedStart);
          logger.debug('Span labeling request coalesced', {
            operation,
            requestId,
            userId,
            coalescedTime,
            textLength: text.length,
          });

          headers['X-Cache'] = 'COALESCED';
          headers['X-Coalesced'] = '1';
          headers['X-Coalesced-Time'] = `${coalescedTime}ms`;
        } else {
          const apiStartTime = performance.now();
          const labelPromise = (async () => {
            const computed = await labelSpans(payload, aiService);

            if (spanLabelingCache) {
              const ttl = text.length > 2000 ? 300 : 3600;
              await spanLabelingCache.set(
                text,
                cachePolicy,
                cacheTemplateVersion,
                computed,
                { ttl, provider: getCurrentSpanProvider() }
              );
            }

            return computed;
          })();

          inflightRequests.set(coalescingKey, labelPromise);

          try {
            result = await labelPromise;
          } finally {
            inflightRequests.delete(coalescingKey);
          }

          const apiTime = Math.round(performance.now() - apiStartTime);

          logger.info('Operation completed.', {
            operation,
            requestId,
            userId,
            duration: Math.round(performance.now() - startTimeMs),
            apiTime,
            textLength: text.length,
            spanCount: result.spans?.length || 0,
            cacheHit: false,
            coalesced: false,
          });

          headers['X-Cache'] = 'MISS';
          headers['X-API-Time'] = `${apiTime}ms`;
        }
      }

      return { result, headers };
    },
  };
}
