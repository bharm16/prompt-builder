import express, { type Router } from 'express';
import { PerformanceMonitor } from '@middleware/performanceMonitor';
import { registerEnhancementSuggestionsRoute } from './enhancement/enhancementSuggestionsRoute';
import { registerCustomSuggestionsRoute } from './enhancement/customSuggestionsRoute';
import { registerSceneChangeRoute } from './enhancement/sceneChangeRoute';
import { registerNlpTestRoute } from './enhancement/nlpTestRoute';
import { registerCoherenceCheckRoute } from './enhancement/coherenceCheckRoute';

interface EnhancementServices {
  enhancementService: any;
  sceneDetectionService: any;
  promptCoherenceService: any;
  metricsService?: any;
}

/**
 * Create enhancement routes
 * Handles enhancement suggestions, custom suggestions, scene detection, and NLP testing
 */
export function createEnhancementRoutes(services: EnhancementServices): Router {
  const router = express.Router();
  const { enhancementService, sceneDetectionService, promptCoherenceService, metricsService } = services;

  const perfMonitor = new PerformanceMonitor(metricsService);

  registerEnhancementSuggestionsRoute(router, { enhancementService, perfMonitor });
  registerCustomSuggestionsRoute(router, { enhancementService });
  registerSceneChangeRoute(router, { sceneDetectionService });
  registerCoherenceCheckRoute(router, { promptCoherenceService, perfMonitor });
  registerNlpTestRoute(router);

  return router;
}
