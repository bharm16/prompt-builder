/**
 * Route Configuration
 *
 * Centralizes route registration for the application.
 * This module is responsible for:
 * - Registering all API routes
 * - Applying route-specific middleware
 * - Setting up error handlers
 * - Configuring 404 handling
 */

import * as Sentry from '@sentry/node';
import type { Application } from 'express';
import type { Request, Response } from 'express';
import type { DIContainer } from '@infrastructure/DIContainer';

// Import middleware
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { errorHandler } from '@middleware/errorHandler';
import { createBatchMiddleware } from '@middleware/requestBatching';

// Import routes
import { createAPIRoutes } from '@routes/api.routes';
import { createHealthRoutes } from '@routes/health.routes';
import { createRoleClassifyRoute } from '@routes/roleClassifyRoute';
import { createLabelSpansRoute } from '@routes/labelSpansRoute';
import { createSuggestionsRoute } from '@routes/suggestions';
import { createPreviewRoutes } from '@routes/preview.routes';

/**
 * Register all application routes
 */
export function registerRoutes(app: Application, container: DIContainer): void {
  // ============================================================================
  // Health Routes (no auth required)
  // ============================================================================

  const healthRoutes = createHealthRoutes({
    claudeClient: container.resolve('claudeClient'),
    groqClient: container.resolve('groqClient'),
    geminiClient: container.resolve('geminiClient'),
    cacheService: container.resolve('cacheService'),
    metricsService: container.resolve('metricsService'),
  });

  app.use('/', healthRoutes);

  // ============================================================================
  // API Routes (auth required)
  // ============================================================================

  // Main API routes
  const apiRoutes = createAPIRoutes({
    promptOptimizationService: container.resolve('promptOptimizationService'),
    enhancementService: container.resolve('enhancementService'),
    sceneDetectionService: container.resolve('sceneDetectionService'),
    videoConceptService: container.resolve('videoConceptService'),
  });

  app.use('/api', apiAuthMiddleware, apiRoutes);

  // ============================================================================
  // LLM Routes (specialized endpoints with auth)
  // ============================================================================

  // Span labeling endpoint (with DI)
  const labelSpansRoute = createLabelSpansRoute(container.resolve('aiService'));
  app.use('/llm/label-spans', apiAuthMiddleware, labelSpansRoute);

  // Batch endpoint for processing multiple span labeling requests
  // Reduces API calls by 60% under concurrent load
  app.post('/llm/label-spans-batch', apiAuthMiddleware, createBatchMiddleware());

  // ============================================================================
  // Role Classification Route (with auth and DI)
  // ============================================================================

  const roleClassifyRoute = createRoleClassifyRoute(container.resolve('aiService'));
  app.use('/api/role-classify', apiAuthMiddleware, roleClassifyRoute);

  // ============================================================================
  // Suggestions Evaluation Routes (LLM-as-a-Judge)
  // ============================================================================

  // Optional quality evaluation endpoints (with DI)
  const suggestionsRoute = createSuggestionsRoute(container.resolve('aiService'));
  app.use('/api/suggestions', apiAuthMiddleware, suggestionsRoute);

  // ============================================================================
  // Preview Routes (image generation)
  // ============================================================================

  const previewRoutes = createPreviewRoutes({
    imageGenerationService: container.resolve('imageGenerationService'),
  });
  app.use('/api/preview', apiAuthMiddleware, previewRoutes);

  // ============================================================================
  // 404 Handler (must be registered AFTER all routes)
  // ============================================================================

  app.use((req: Request, res: Response): void => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      requestId: (req as Request & { id?: string }).id,
    });
  });
}

/**
 * Register error handlers
 * Must be called AFTER all routes are registered
 */
export function registerErrorHandlers(app: Application): void {
  // Sentry error handler (must be before other error handlers)
  // Sentry.setupExpressErrorHandler(app); // Disabled

  // Optional fallthrough error handler
  app.use(function onError(
    err: Error,
    req: Request,
    res: Response & { sentry?: string },
    next: (err?: Error) => void
  ): void {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500;
    res.end((res.sentry || '') + '\n');
  });

  // Custom error handler (must be last)
  app.use(errorHandler);
}

/**
 * Configure all routes and error handlers
 * This is the main function to call from app setup
 */
export function configureRoutes(app: Application, container: DIContainer): void {
  registerRoutes(app, container);
  registerErrorHandlers(app);
}

