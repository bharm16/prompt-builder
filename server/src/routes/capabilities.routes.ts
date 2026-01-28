import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { logger } from '@infrastructure/Logger';
import { getCapabilities, listModels, listProviders, resolveProviderForModel } from '@services/capabilities';

export function createCapabilitiesRoutes(): Router {
  const router = express.Router();

  router.get(
    '/providers',
    asyncHandler(async (_req, res) => {
      res.json({ providers: listProviders() });
    })
  );

  router.get(
    '/registry',
    asyncHandler(async (_req, res) => {
      const { getCapabilitiesRegistry } = await import('@services/capabilities');
      res.json(getCapabilitiesRegistry());
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
      const requestedProvider =
        typeof req.query.provider === 'string' && req.query.provider.trim()
          ? req.query.provider.trim()
          : 'generic';
      const model =
        typeof req.query.model === 'string' && req.query.model.trim()
          ? req.query.model.trim()
          : 'auto';

      let schema = getCapabilities(requestedProvider, model);
      let resolvedProvider: string | null = null;

      if (!schema && requestedProvider === 'generic' && model !== 'auto') {
        resolvedProvider = resolveProviderForModel(model);
        if (resolvedProvider) {
          schema = getCapabilities(resolvedProvider, model);
        }
      }

      if (!schema) {
        logger.warn('Capabilities schema not found', {
          provider: requestedProvider,
          model,
          resolvedProvider,
        });
        res.status(404).json({
          error: 'Capabilities not found',
          provider: requestedProvider,
          model,
          resolvedProvider,
        });
        return;
      }

      res.json(schema);
    })
  );

  return router;
}
