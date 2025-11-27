// server/routes/roleClassifyRoute.ts
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

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { spans, templateVersion = 'v1' } = (req.body || {}) as { 
        spans?: unknown[]; 
        templateVersion?: string;
      };

      if (!Array.isArray(spans)) {
        return res.status(400).json({ error: 'spans[] required' });
      }

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

      const labeled: LabeledSpan[] = await roleClassify(clean, String(templateVersion), aiService);
      res.json({ spans: labeled });
    } catch (error) {
      res
        .status(500)
        .json({ error: String((error as { message?: unknown })?.message || error || 'Unknown error') });
    }
  });

  return router;
}

