import express, { type Router } from 'express';
import type { SuggestionsHandlers } from './handlers';

export function createSuggestionsRouter(handlers: SuggestionsHandlers): Router {
  const router = express.Router();

  router.post('/evaluate', handlers.evaluate);
  router.post('/evaluate/single', handlers.evaluateSingle);
  router.post('/evaluate/compare', handlers.compare);
  router.get('/rubrics', handlers.getRubrics);

  return router;
}
