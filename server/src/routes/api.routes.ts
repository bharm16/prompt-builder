/**
 * API Routes Aggregator
 * 
 * Mounts domain-specific route modules under /api
 * 
 * Route structure:
 * - /api/optimize, /api/optimize-stream → optimize.routes.ts
 * - /api/video/* → video.routes.ts
 * - /api/get-enhancement-suggestions, /api/get-custom-suggestions, 
 *   /api/detect-scene-change, /api/test-nlp → enhancement.routes.ts
 */

import express, { type Router } from 'express';
import { createOptimizeRoutes } from './optimize.routes';
import { createVideoRoutes } from './video.routes';
import { createEnhancementRoutes } from './enhancement.routes';

interface ApiServices {
  promptOptimizationService: any;
  enhancementService: any;
  sceneDetectionService: any;
  videoConceptService: any;
  metricsService?: any;
}

/**
 * Create API routes
 * @param services - Service instances
 * @returns Express router
 */
export function createAPIRoutes(services: ApiServices): Router {
  const router = express.Router();

  const {
    promptOptimizationService,
    enhancementService,
    sceneDetectionService,
    videoConceptService,
    metricsService,
  } = services;

  // Mount optimization routes at root level (preserves /api/optimize paths)
  router.use(
    '/',
    createOptimizeRoutes({ promptOptimizationService })
  );

  // Mount video routes under /video (creates /api/video/* paths)
  router.use(
    '/video',
    createVideoRoutes({ videoConceptService })
  );

  // Mount enhancement routes at root level (preserves existing paths)
  router.use(
    '/',
    createEnhancementRoutes({
      enhancementService,
      sceneDetectionService,
      metricsService,
    })
  );

  return router;
}
