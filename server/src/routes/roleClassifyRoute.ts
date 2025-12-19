// server/routes/roleClassifyRoute.ts
import { logger } from '@infrastructure/Logger';
import type { Router, Request, Response } from 'express';
import { Router as ExpressRouter } from 'express';
import { roleClassify } from '../llm/roleClassifier.js';
import type { AIModelService } from '../services/ai-model/AIModelService.js';
import type { InputSpan, LabeledSpan } from '../llm/types.js';

/**
 * Create role classify route with dependency injection
 */
export function createRoleClassifyRoute(aiService: AIModelService): Router {
  const router = ExpressRouter();
  const log = logger.child({ service: 'roleClassifyRoute' });

  router.post('/', async (req: Request, res: Response) => {
    const startTime = performance.now();
    const operation = 'roleClassify';
    const requestId = (req as Request & { id?: string }).id || 'unknown';
    
    log.debug('Role classify request received', {
      operation,
      requestId,
    });

    try {
      const { spans, templateVersion = 'v1' } = (req.body || {}) as { 
        spans?: unknown[]; 
        templateVersion?: string;
      };

      if (!Array.isArray(spans)) {
        log.warn('Invalid request: spans[] required', {
          operation,
          requestId,
          hasSpans: !!spans,
        });
        return res.status(400).json({ error: 'spans[] required' });
      }

      log.debug('Processing spans', {
        operation,
        requestId,
        inputSpanCount: spans.length,
        templateVersion,
      });

      const clean: InputSpan[] = spans
        .filter(Boolean)
        .map((span: unknown) => {
          const s = span as { text?: unknown; start?: unknown; end?: unknown };
          return {
            text: String(s?.text ?? ''),
            start: Number.isInteger(s?.start) ? (s.start as number) : -1,
            end: Number.isInteger(s?.end) ? (s.end as number) : -1,
          };
        })
        .filter((span: InputSpan) => span.text && span.start >= 0 && span.end > span.start);

      log.debug('Spans cleaned and validated', {
        operation,
        requestId,
        cleanSpanCount: clean.length,
        filteredCount: spans.length - clean.length,
      });

      const labeled: LabeledSpan[] = await roleClassify(clean, String(templateVersion), aiService);
      
      const duration = Math.round(performance.now() - startTime);
      
      log.info('Role classification complete', {
        operation,
        requestId,
        duration,
        inputSpanCount: spans.length,
        outputSpanCount: labeled.length,
        templateVersion,
      });
      
      res.json({ spans: labeled });
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      log.error('Role classification failed', error as Error, {
        operation,
        requestId,
        duration,
      });
      
      res
        .status(500)
        .json({ error: String((error as { message?: unknown })?.message || error || 'Unknown error') });
    }
  });

  return router;
}

