import type { Router } from 'express';
import type { AIModelService } from '@services/ai-model/AIModelService';
import { createSuggestionsServices } from './suggestions/serviceFactory';
import { createSuggestionsHandlers } from './suggestions/handlers';
import { createSuggestionsRouter } from './suggestions/router';

/**
 * Create suggestions route with dependency injection
 * @param {Object} aiService - AI Model Service instance
 * @returns {Router} Express router
 */
export function createSuggestionsRoute(aiService: AIModelService): Router {
  const services = createSuggestionsServices(aiService);
  const handlers = createSuggestionsHandlers(services);
  return createSuggestionsRouter(handlers);
}
