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
import { createConvergenceRoutes } from '@routes/convergence/convergence.routes';
import { userCreditService } from '@services/credits/UserCreditService';

// Import convergence services
import {
  ConvergenceService,
  getSessionStore,
  getPromptBuilderService,
  getCreditsService,
  getGCSStorageService,
  createDepthEstimationService,
  createVideoPreviewService,
} from '@services/convergence';
import type { ImageGenerationService } from '@services/image-generation';

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
  // Convergence Routes (Visual Convergence feature - auth required)
  // ============================================================================

  if (!promptOutputOnly) {
    const imageGenerationService = container.resolve<ImageGenerationService | null>('imageGenerationService');

    // Only register convergence routes if image generation is available
    if (imageGenerationService) {
      try {
        // Initialize convergence service dependencies
        const storageService = getGCSStorageService();
        const depthEstimationService = createDepthEstimationService({
          storageService,
        });
        const videoPreviewService = createVideoPreviewService({
          storageService,
        });

        // Create the ConvergenceService with all dependencies
        const convergenceService = new ConvergenceService({
          imageGenerationService,
          depthEstimationService,
          sessionStore: getSessionStore(),
          promptBuilder: getPromptBuilderService(),
          creditsService: getCreditsService(),
          storageService,
          videoPreviewService,
        });

        // Create and register convergence routes
        const convergenceRoutes = createConvergenceRoutes({
          convergenceService,
        });

        app.use('/api/convergence', apiAuthMiddleware, convergenceRoutes);
      } catch (error) {
        // Log error but don't fail app startup - convergence is optional
        const errorInstance = error instanceof Error ? error : new Error(String(error));
        logger.warn('Failed to initialize convergence routes', {
          error: errorInstance.message,
          errorName: errorInstance.name,
          stack: errorInstance.stack,
        });
      }
    }
  }

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
