import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { logger } from '@infrastructure/Logger';
import {
  getCapabilities,
  listModels,
  listProviders,
  resolveModelId,
  resolveProviderForModel,
} from '@services/capabilities';

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

      const resolvedModel = resolveModelId(model) ?? model;
      const modelCandidates = resolvedModel === model ? [model] : [model, resolvedModel];
      const getSchema = (provider: string) =>
        modelCandidates
          .map((candidateModel) => getCapabilities(provider, candidateModel))
          .find((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)) ?? null;

      let schema = getSchema(requestedProvider);
      let resolvedProvider: string | null = null;

      if (!schema && requestedProvider === 'generic' && model !== 'auto') {
        resolvedProvider = resolveProviderForModel(resolvedModel);
        if (resolvedProvider) {
          schema = getSchema(resolvedProvider);
        }
      }

      if (!schema) {
        logger.warn('Capabilities schema not found', {
          provider: requestedProvider,
          model,
          resolvedModel,
          resolvedProvider,
        });
        res.status(404).json({
          error: 'Capabilities not found',
          provider: requestedProvider,
          model,
          resolvedModel,
          resolvedProvider,
        });
        return;
      }

      res.json(schema);
    })
  );

  return router;
}
