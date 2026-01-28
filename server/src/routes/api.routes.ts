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
import { createCapabilitiesRoutes } from './capabilities.routes';
import { createEnhancementRoutes, type EnhancementServices } from './enhancement.routes';
import { createStorageRoutes } from './storage.routes';
import { createAssetRoutes } from './asset.routes';
import { createConsistentGenerationRoutes } from './consistentGeneration.routes';
import { createReferenceImagesRoutes } from './reference-images.routes';
import { createImageObservationRoutes } from './image-observation.routes';
import { createContinuityRoutes } from './continuity.routes';
import { createModelIntelligenceRoutes } from './model-intelligence.routes';
import type { OptimizeServices } from './optimize/types';
import type { VideoServices } from './video/types';
import type { ReferenceImageService } from '@services/reference-images/ReferenceImageService';
import type { AssetService } from '@services/asset/AssetService';
import type { ConsistentVideoService } from '@services/generation/ConsistentVideoService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { ImageObservationService } from '@services/image-observation';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { ModelIntelligenceService } from '@services/model-intelligence/ModelIntelligenceService';

interface ApiServices extends OptimizeServices, EnhancementServices {
  videoConceptService?: VideoServices['videoConceptService'] | null;
  assetService?: AssetService;
  consistentVideoService?: ConsistentVideoService;
  userCreditService?: UserCreditService;
  referenceImageService?: ReferenceImageService | null;
  imageObservationService?: ImageObservationService | null;
  continuitySessionService?: ContinuitySessionService | null;
  modelIntelligenceService?: ModelIntelligenceService | null;
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
    promptCoherenceService,
    videoConceptService,
    metricsService,
    assetService,
    consistentVideoService,
    userCreditService,
    referenceImageService,
    imageObservationService,
    continuitySessionService,
    modelIntelligenceService,
  } = services;

  // Mount optimization routes at root level (preserves /api/optimize paths)
  router.use(
    '/',
    createOptimizeRoutes({ promptOptimizationService })
  );

  // Mount video routes under /video (creates /api/video/* paths)
  if (videoConceptService) {
    router.use(
      '/video',
      createVideoRoutes({ videoConceptService })
    );
  }

  // Mount enhancement routes at root level (preserves existing paths)
  router.use(
    '/',
    createEnhancementRoutes({
      enhancementService,
      sceneDetectionService,
      promptCoherenceService,
      metricsService,
    })
  );

  // Mount storage routes under /storage
  router.use('/storage', createStorageRoutes());

  if (assetService) {
    router.use('/assets', createAssetRoutes(assetService));
  }

  if (referenceImageService) {
    router.use('/reference-images', createReferenceImagesRoutes(referenceImageService));
  }

  if (imageObservationService) {
    router.use('/', createImageObservationRoutes(imageObservationService));
  }

  if (consistentVideoService) {
    router.use(
      '/generate/consistent',
      createConsistentGenerationRoutes(consistentVideoService, userCreditService)
    );
  }

  if (continuitySessionService) {
    router.use('/continuity', createContinuityRoutes(continuitySessionService, userCreditService));
  }

  if (modelIntelligenceService) {
    router.use('/', createModelIntelligenceRoutes(modelIntelligenceService));
  }

  // Capabilities registry routes (schema-driven UI)
  router.use('/', createCapabilitiesRoutes());

  return router;
}
