// server/routes/roleClassifyRoute.ts
import { logger } from '@infrastructure/Logger';
import type { Router, Request, Response } from 'express';
import { Router as ExpressRouter } from 'express';
import { roleClassify } from '@llm/roleClassifier';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { LabeledSpan } from '@llm/types';
import { RoleClassifyRequestSchema } from '../schemas/roleClassify.schema';

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
      const parseResult = RoleClassifyRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
         log.warn('Invalid request', {
          operation,
          requestId,
          error: parseResult.error,
        });
        return res.status(400).json({ error: 'Invalid request format' });
      }

      const { spans: cleanSpans, templateVersion } = parseResult.data;

      log.debug('Spans cleaned and validated', {
        operation,
        requestId,
        cleanSpanCount: cleanSpans.length,
        templateVersion,
      });

      const labeled: LabeledSpan[] = await roleClassify(cleanSpans, String(templateVersion), aiService);
      
      const duration = Math.round(performance.now() - startTime);
      
      log.info('Role classification complete', {
        operation,
        requestId,
        duration,
        outputSpanCount: labeled.length,
        templateVersion,
      });
      
      return res.json({ spans: labeled });
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      log.error('Role classification failed', error as Error, {
        operation,
        requestId,
        duration,
      });
      
      return res
        .status(500)
        .json({ error: String((error as { message?: unknown })?.message || error || 'Unknown error') });
    }
  });

  return router;
}
