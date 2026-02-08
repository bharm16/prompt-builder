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

import type { Application, Request, Response } from 'express';
import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';

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
import { createPreviewRoutes, createPublicPreviewRoutes } from '@routes/preview.routes';
import { createPaymentRoutes } from '@routes/payment.routes';
import { createConvergenceMediaRoutes } from '@routes/convergence/convergenceMedia.routes';
import { createMotionRoutes } from '@routes/motion.routes';
import { userCreditService } from '@services/credits/UserCreditService';

type RequestWithId = Request & {
  id?: string;
};

/**
 * Register all application routes
 */
export function registerRoutes(app: Application, container: DIContainer): void {
  const promptOutputOnly = process.env.PROMPT_OUTPUT_ONLY === 'true';

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
  // Public Preview Routes (no auth required for video content)
  // ============================================================================

  if (!promptOutputOnly) {
    const publicPreviewRoutes = createPublicPreviewRoutes({
      videoGenerationService: container.resolve('videoGenerationService'),
      videoContentAccessService: container.resolve('videoContentAccessService'),
    });
    app.use('/api/preview', publicPreviewRoutes);

    const motionMediaRoutes = createConvergenceMediaRoutes();
    app.use('/api/motion/media', motionMediaRoutes);
  }

  // ============================================================================
  // API Routes (auth required)
  // ============================================================================

  // Main API routes
  const apiRoutes = createAPIRoutes({
    promptOptimizationService: container.resolve('promptOptimizationService'),
    enhancementService: container.resolve('enhancementService'),
    sceneDetectionService: container.resolve('sceneDetectionService'),
    promptCoherenceService: container.resolve('promptCoherenceService'),
    videoConceptService: promptOutputOnly ? null : container.resolve('videoConceptService'),
    assetService: container.resolve('assetService'),
    consistentVideoService: container.resolve('consistentVideoService'),
    userCreditService: container.resolve('userCreditService'),
    referenceImageService: container.resolve('referenceImageService'),
    imageObservationService: container.resolve('imageObservationService'),
    continuitySessionService: container.resolve('continuitySessionService'),
    sessionService: container.resolve('sessionService'),
    modelIntelligenceService: container.resolve('modelIntelligenceService'),
  });

  app.use('/api', apiAuthMiddleware, apiRoutes);

  // ============================================================================
  // Motion Routes (auth required)
  // ============================================================================

  if (!promptOutputOnly) {
    const motionRoutes = createMotionRoutes();
    app.use('/api/motion', apiAuthMiddleware, motionRoutes);
  }

  // ============================================================================
  // LLM Routes (specialized endpoints with auth)
  // ============================================================================

  // Span labeling endpoint (with DI)
  const labelSpansRoute = createLabelSpansRoute(container.resolve('aiService'));
  app.use('/llm/label-spans', apiAuthMiddleware, labelSpansRoute);

  // Batch endpoint for processing multiple span labeling requests
  // Reduces API calls by 60% under concurrent load
  app.post(
    '/llm/label-spans-batch',
    apiAuthMiddleware,
    createBatchMiddleware(container.resolve('aiService'))
  );

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
  // Preview Routes (image and video generation)
  // ============================================================================

  if (!promptOutputOnly) {
    const previewRoutes = createPreviewRoutes({
      imageGenerationService: container.resolve('imageGenerationService'),
      storyboardPreviewService: container.resolve('storyboardPreviewService'),
      videoGenerationService: container.resolve('videoGenerationService'),
      videoJobStore: container.resolve('videoJobStore'),
      videoContentAccessService: container.resolve('videoContentAccessService'),
      userCreditService,
      keyframeService: container.resolve('keyframeService'),
      faceSwapService: container.resolve('faceSwapService'),
      assetService: container.resolve('assetService'),
    });
    app.use('/api/preview', apiAuthMiddleware, previewRoutes);
  }

  // ============================================================================
  // Payment Routes (auth required)
  // ============================================================================

  const paymentRoutes = createPaymentRoutes();
  app.use('/api/payment', apiAuthMiddleware, paymentRoutes);

  // ============================================================================
  // 404 Handler (must be registered AFTER all routes)
  // ============================================================================

  app.use((req: RequestWithId, res: Response): void => {
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
    // Only short-circuit when Sentry has attached an error id.
    if (res.headersSent) {
      next(err);
      return;
    }
    if (res.sentry) {
      res.statusCode = 500;
      res.end(`${res.sentry}\n`);
      return;
    }
    next(err);
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
