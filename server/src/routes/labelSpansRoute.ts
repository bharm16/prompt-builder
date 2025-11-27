import type { Router, Request, Response } from 'express';
import { Router as ExpressRouter } from 'express';
import { logger } from '@infrastructure/Logger';
import { labelSpans } from '../llm/span-labeling/SpanLabelingService.js';
import { spanLabelingCache } from '../services/cache/SpanLabelingCacheService.js';
import type { AIModelService } from '../services/ai-model/AIModelService.js';
import type { LabelSpansParams, LabelSpansResult } from '../llm/span-labeling/types.js';
import type { ValidationPolicy } from '../llm/span-labeling/types.js';

/**
 * Create label spans route with dependency injection
 */
export function createLabelSpansRoute(aiService: AIModelService): Router {
  const router = ExpressRouter();

  const sanitizeNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
  };

  router.post('/', async (req: Request, res: Response) => {
    const { text, maxSpans, minConfidence, policy, templateVersion } = (req.body || {}) as {
      text?: unknown;
      maxSpans?: unknown;
      minConfidence?: unknown;
      policy?: ValidationPolicy;
      templateVersion?: string;
    };

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const safeMaxSpans = sanitizeNumber(maxSpans);
    if (safeMaxSpans !== undefined && (!Number.isInteger(safeMaxSpans) || safeMaxSpans <= 0 || safeMaxSpans > 80)) {
      return res.status(400).json({ error: 'maxSpans must be an integer between 1 and 80' });
    }

    const safeMinConfidence = sanitizeNumber(minConfidence);
    if (
      safeMinConfidence !== undefined &&
      (typeof safeMinConfidence !== 'number' ||
        Number.isNaN(safeMinConfidence) ||
        safeMinConfidence < 0 ||
        safeMinConfidence > 1)
    ) {
      return res.status(400).json({ error: 'minConfidence must be between 0 and 1' });
    }

    const payload: LabelSpansParams = {
      text,
      maxSpans: safeMaxSpans,
      minConfidence: safeMinConfidence,
      policy,
      templateVersion,
    };

    try {
      // Cache-aside pattern: Check cache first
      // This reduces API calls by 70-90% and provides <5ms response time for cached results
      let result: LabelSpansResult | undefined;
      let cacheHit = false;

      if (spanLabelingCache) {
        const startTime = Date.now();
        const cached = await spanLabelingCache.get(text, policy, templateVersion);

        if (cached) {
          result = cached;
          cacheHit = true;

          const cacheTime = Date.now() - startTime;
          logger.debug('Span labeling cache hit', {
            cacheTime,
            textLength: text.length,
          });

          // Add cache hit header for monitoring
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Time', `${cacheTime}ms`);
        }
      }

      // Cache miss: use AIModelService (configured in modelConfig.js)
      if (!result) {
        const startTime = Date.now();

        // Use AIModelService which respects modelConfig.js configuration
        result = await labelSpans(payload, aiService);

        const apiTime = Date.now() - startTime;

        // Store in cache for future requests
        if (spanLabelingCache) {
          // Use short TTL (5 min) for large texts, default TTL (1 hour) for smaller ones
          const ttl = text.length > 2000 ? 300 : 3600;
          await spanLabelingCache.set(text, policy, templateVersion, result, { ttl });
        }

        logger.info('Span labeling completed', {
          apiTime,
          textLength: text.length,
          spanCount: result.spans?.length || 0,
        });

        // Add cache miss headers for monitoring
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-API-Time', `${apiTime}ms`);
      }

      return res.json(result);
    } catch (error) {
      logger.warn('label-spans request failed', {
        error: (error as { message?: string })?.message,
        stack: (error as { stack?: string })?.stack,
        textLength: text?.length,
      });
      return res.status(502).json({
        error: 'LLM span labeling failed',
        message: (error as { message?: string })?.message || 'Unknown error',
      });
    }
  });

  return router;
}

