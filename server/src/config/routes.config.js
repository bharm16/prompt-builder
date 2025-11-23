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

// Import middleware
import { apiAuthMiddleware } from '../middleware/apiAuth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createBatchMiddleware } from '../middleware/requestBatching.js';

// Import routes
import { createAPIRoutes } from '../routes/api.routes.js';
import { createHealthRoutes } from '../routes/health.routes.js';
import { createRoleClassifyRoute } from '../routes/roleClassifyRoute.js';
import { createLabelSpansRoute } from '../routes/labelSpansRoute.js';
import suggestionsRoutes from '../routes/suggestions.js';

/**
 * Register all application routes
 *
 * @param {express.Application} app - Express app instance
 * @param {DIContainer} container - Dependency injection container
 */
export function registerRoutes(app, container) {
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
    textCategorizerService: container.resolve('textCategorizerService'),
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

  // Optional quality evaluation endpoints
  app.use('/api/suggestions', apiAuthMiddleware, suggestionsRoutes);

  // ============================================================================
  // 404 Handler (must be registered AFTER all routes)
  // ============================================================================

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      requestId: req.id,
    });
  });
}

/**
 * Register error handlers
 * Must be called AFTER all routes are registered
 *
 * @param {express.Application} app - Express app instance
 */
export function registerErrorHandlers(app) {
  // Sentry error handler (must be before other error handlers)
  Sentry.setupExpressErrorHandler(app);

  // Optional fallthrough error handler
  app.use(function onError(err, req, res, next) {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500;
    res.end(res.sentry + '\n');
  });

  // Custom error handler (must be last)
  app.use(errorHandler);
}

/**
 * Configure all routes and error handlers
 * This is the main function to call from app setup
 *
 * @param {express.Application} app - Express app instance
 * @param {DIContainer} container - Dependency injection container
 */
export function configureRoutes(app, container) {
  registerRoutes(app, container);
  registerErrorHandlers(app);
}
