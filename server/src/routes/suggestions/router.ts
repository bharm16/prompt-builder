import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import type { SuggestionsHandlers } from './handlers';

export function createSuggestionsRouter(handlers: SuggestionsHandlers): Router {
  const router = express.Router();

  router.post('/evaluate', asyncHandler(handlers.evaluate));
  router.post('/evaluate/single', asyncHandler(handlers.evaluateSingle));
  router.post('/evaluate/compare', asyncHandler(handlers.compare));
  router.get('/rubrics', handlers.getRubrics);

  return router;
}
