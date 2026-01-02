import { createHash } from 'crypto';
import type { Router, Request, Response } from 'express';
import { Router as ExpressRouter } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { labelSpans, labelSpansStream } from '@llm/span-labeling/SpanLabelingService';
import { getCurrentSpanProvider } from '@llm/span-labeling/services/LlmClientFactory';
import { spanLabelingCache } from '@services/cache/SpanLabelingCacheService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { LabelSpansParams, LabelSpansResult } from '@llm/span-labeling/types';
import type { ValidationPolicy } from '@llm/span-labeling/types';

/**
 * Create label spans route with dependency injection
 */
export function createLabelSpansRoute(aiService: AIModelService): Router {
  const router = ExpressRouter();
  const inflightRequests = new Map<string, Promise<LabelSpansResult>>();

  const sanitizeNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
  };

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

  router.post('/stream', async (req: Request, res: Response) => {
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
      ...(safeMaxSpans !== undefined ? { maxSpans: safeMaxSpans } : {}),
      ...(safeMinConfidence !== undefined ? { minConfidence: safeMinConfidence } : {}),
      ...(policy ? { policy } : {}),
      ...(templateVersion ? { templateVersion } : {}),
    };

    const requestId = (req as Request & { id?: string }).id;
    const userId = extractUserId(req);
    const operation = 'labelSpansStream';

    logger.debug(`Starting ${operation}`, {
      operation,
      requestId,
      userId,
      textLength: text.length,
    });

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = labelSpansStream(payload, aiService);
      for await (const span of stream) {
        const transformed = {
          text: span.text,
          start: span.start,
          end: span.end,
          category: span.role,
          confidence: span.confidence,
        };
        res.write(JSON.stringify(transformed) + '\n');
      }
      res.end();
      return;
    } catch (error) {
      logger.error(`${operation} failed`, error as Error, {
        operation,
        requestId,
        userId,
      });
      // Try to write error to stream if possible
      if (!res.headersSent) {
          return res.status(502).json({ error: 'Streaming failed' });
      } else {
          res.write(JSON.stringify({ error: 'Streaming failed' }) + '\n');
          res.end();
          return;
      }
    }
  });

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
      ...(safeMaxSpans !== undefined ? { maxSpans: safeMaxSpans } : {}),
      ...(safeMinConfidence !== undefined ? { minConfidence: safeMinConfidence } : {}),
      ...(policy ? { policy } : {}),
      ...(templateVersion ? { templateVersion } : {}),
    };

    const startTime = performance.now();
    const operation = 'labelSpans';
    const requestId = (req as Request & { id?: string }).id;
    const userId = extractUserId(req);
    
    logger.debug(`Starting ${operation}`, {
      operation,
      requestId,
      userId,
      textLength: text.length,
      maxSpans: safeMaxSpans,
      minConfidence: safeMinConfidence,
      policy,
      templateVersion,
    });

    try {
      // Cache-aside pattern: Check cache first
      // This reduces API calls by 70-90% and provides <5ms response time for cached results
      let result: LabelSpansResult | null = null;
      let cacheHit = false;
      const cachePolicy = policy ?? null;
      const cacheTemplateVersion = templateVersion ?? null;

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
          cacheHit = true;

          const cacheTime = Math.round(performance.now() - cacheStartTime);
          logger.debug('Span labeling cache hit', {
            operation,
            requestId,
            userId,
            cacheTime,
            textLength: text.length,
            spanCount: cached.spans.length,
            duration: Math.round(performance.now() - startTime),
          });

          // Add cache hit header for monitoring
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Time', `${cacheTime}ms`);
        }
      }

      // Cache miss: use AIModelService (configured in modelConfig.js)
      if (!result) {
        const coalescingKey = createCoalescingKey(text, cachePolicy, cacheTemplateVersion);
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

          res.setHeader('X-Cache', 'COALESCED');
          res.setHeader('X-Coalesced', '1');
          res.setHeader('X-Coalesced-Time', `${coalescedTime}ms`);
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

          logger.info(`${operation} completed`, {
            operation,
            requestId,
            userId,
            duration: Math.round(performance.now() - startTime),
            apiTime,
            textLength: text.length,
            spanCount: result.spans?.length || 0,
            cacheHit: false,
            coalesced: false,
          });

          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-API-Time', `${apiTime}ms`);
        }
      }

      if (!result) {
        return res.status(502).json({ error: 'Span labeling failed to produce a result' });
      }
      
      // Transform response: backend uses 'role' internally, frontend expects 'category'
      const transformedResult = {
        ...result,
        spans: (result.spans || []).map(span => ({
          text: span.text,
          start: span.start,
          end: span.end,
          category: span.role, // Map role → category for frontend
          confidence: span.confidence,
        })),
      };
      
      return res.json(transformedResult);
    } catch (error) {
      logger.error(`${operation} failed`, error as Error, {
        operation,
        requestId,
        userId,
        duration: Math.round(performance.now() - startTime),
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
