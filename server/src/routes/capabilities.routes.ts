import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { logger } from '@infrastructure/Logger';
import { getCapabilities, listModels, listProviders } from '@services/capabilities';

export function createCapabilitiesRoutes(): Router {
  const router = express.Router();

  router.get(
    '/providers',
    asyncHandler(async (_req, res) => {
      res.json({ providers: listProviders() });
    })
  );

  router.get(
    '/models',
    asyncHandler(async (req, res) => {
      const provider = typeof req.query.provider === 'string' ? req.query.provider : '';
      if (!provider) {
        res.status(400).json({ error: 'provider is required' });
        return;
      }
      res.json({ provider, models: listModels(provider) });
    })
  );

  router.get(
    '/capabilities',
    asyncHandler(async (req, res) => {
      const provider =
        typeof req.query.provider === 'string' && req.query.provider.trim()
          ? req.query.provider.trim()
          : 'generic';
      const model =
        typeof req.query.model === 'string' && req.query.model.trim()
          ? req.query.model.trim()
          : 'auto';

      const schema = getCapabilities(provider, model);
      if (!schema) {
        logger.warn('Capabilities schema not found', { provider, model });
        res.status(404).json({ error: 'Capabilities not found', provider, model });
        return;
      }

      res.json(schema);
    })
  );

  return router;
}
