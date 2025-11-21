// server/routes/roleClassifyRoute.js
import { Router } from 'express';
import { roleClassify } from '../llm/roleClassifier.js';

/**
 * Create role classify route with dependency injection
 * @param {Object} aiService - AI Model Service instance
 * @returns {Router} Express router
 */
export function createRoleClassifyRoute(aiService) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const { spans, templateVersion = 'v1' } = req.body || {};

      if (!Array.isArray(spans)) {
        return res.status(400).json({ error: 'spans[] required' });
      }

      const clean = spans
        .filter(Boolean)
        .map((span) => ({
          text: String(span?.text ?? ''),
          start: Number.isInteger(span?.start) ? span.start : -1,
          end: Number.isInteger(span?.end) ? span.end : -1,
        }))
        .filter((span) => span.text && span.start >= 0 && span.end > span.start);

      const labeled = await roleClassify(clean, String(templateVersion), aiService);
      res.json({ spans: labeled });
    } catch (error) {
      res
        .status(500)
        .json({ error: String(error?.message || error || 'Unknown error') });
    }
  });

  return router;
}
