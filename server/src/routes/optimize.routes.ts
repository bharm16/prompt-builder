import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { enforceVideoMode } from '@middleware/enforceVideoMode';
import { normalizeOptimizationRequest } from '@middleware/normalizeOptimizationRequest';
import { requestCoalescing } from '@middleware/requestCoalescing';
import { validateRequest } from '@middleware/validateRequest';
import { promptSchema, compileSchema } from '@utils/validation';
import type { OptimizeServices } from './optimize/types';
import { createOptimizeHandler } from './optimize/handlers/optimize';
import { createOptimizeStreamHandler } from './optimize/handlers/optimizeStream';
import { createOptimizeCompileHandler } from './optimize/handlers/optimizeCompile';

/**
 * Create optimization routes
 * Handles prompt optimization (single-stage and streaming two-stage)
 */
export function createOptimizeRoutes(services: OptimizeServices): Router {
  const router = express.Router();
  const { promptOptimizationService } = services;

  const optimizeHandler = createOptimizeHandler(promptOptimizationService);
  const optimizeStreamHandler = createOptimizeStreamHandler(promptOptimizationService);
  const optimizeCompileHandler = createOptimizeCompileHandler(promptOptimizationService);

  router.post(
    '/optimize',
    requestCoalescing.middleware({ keyScope: '/api/optimize' }),
    normalizeOptimizationRequest,
    enforceVideoMode,
    validateRequest(promptSchema),
    asyncHandler(optimizeHandler)
  );

  router.post(
    '/optimize-stream',
    normalizeOptimizationRequest,
    enforceVideoMode,
    validateRequest(promptSchema),
    asyncHandler(optimizeStreamHandler)
  );

  router.post(
    '/optimize-compile',
    validateRequest(compileSchema),
    asyncHandler(optimizeCompileHandler)
  );

  return router;
}
