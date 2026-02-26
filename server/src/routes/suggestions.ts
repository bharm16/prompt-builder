import type { Router } from 'express';
import {
  createSuggestionsServices,
  type SuggestionsRouteServices,
} from './suggestions/serviceFactory';
import { createSuggestionsHandlers } from './suggestions/handlers';
import { createSuggestionsRouter } from './suggestions/router';

/**
 * Create suggestions route with dependency injection
 * @param services - Suggestions route dependencies
 * @returns {Router} Express router
 */
export function createSuggestionsRoute(services: SuggestionsRouteServices): Router {
  const suggestionsServices = createSuggestionsServices(services);
  const handlers = createSuggestionsHandlers(suggestionsServices);
  return createSuggestionsRouter(handlers);
}
