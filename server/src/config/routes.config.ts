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
import { getFirestore } from '@infrastructure/firebaseAdmin';

// Import middleware
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { errorHandler } from '@middleware/errorHandler';
import { createBatchMiddleware } from '@middleware/requestBatching';
import { createStarterCreditsMiddleware } from '@middleware/starterCredits';

// Import routes
import { createAPIRoutes } from '@routes/api.routes';
import { createHealthRoutes } from '@routes/health.routes';
import { createRoleClassifyRoute } from '@routes/roleClassifyRoute';
import { createLabelSpansRoute } from '@routes/labelSpansRoute';
import type { StorageRoutesService } from '@routes/storage.routes';
import { createSuggestionsRoute } from '@routes/suggestions';
import { createPreviewRoutes, createPublicPreviewRoutes } from '@routes/preview.routes';
import { createPaymentRoutes } from '@routes/payment.routes';
import type { PaymentRouteServices } from '@routes/payment/types';
import { createConvergenceMediaRoutes } from '@routes/convergence/convergenceMedia.routes';
import { createMotionRoutes } from '@routes/motion.routes';
import { CAMERA_PATHS } from '@services/convergence/constants';
import { createDepthEstimationServiceForUser, getDepthWarmupStatus, getStartupWarmupPromise } from '@services/convergence/depth';
import type { GCSStorageService } from '@services/convergence/storage';
import type { VideoConceptServiceContract } from '@routes/video/types';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { ConsistentVideoService } from '@services/generation/ConsistentVideoService';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { ModelIntelligenceService } from '@services/model-intelligence/ModelIntelligenceService';
import type { LLMJudgeService } from '@services/quality-feedback/services/LLMJudgeService';
import type { PreviewRoutesServices } from '@routes/types';
import type { VideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { getRuntimeFlags } from './runtime-flags';

type RequestWithId = Request & {
  id?: string;
};

function resolveOptionalService<T>(
  container: DIContainer,
  serviceName: string,
  routeContext: string
): T | null {
  try {
    return container.resolve<T>(serviceName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Optional route dependency unavailable; route behavior will be degraded', {
      serviceName,
      routeContext,
      error: errorMessage,
    });
    return null;
  }
}

/**
 * Register all application routes
 */
export function registerRoutes(app: Application, container: DIContainer): void {
  const { promptOutputOnly } = getRuntimeFlags();
  const convergenceStorageService = promptOutputOnly
    ? null
    : resolveOptionalService<GCSStorageService | null>(
        container,
        'convergenceStorageService',
        'convergence-storage'
      );
  const userCreditService = container.resolve<UserCreditService>('userCreditService');
  const videoGenerationService = promptOutputOnly
    ? null
    : resolveOptionalService<PreviewRoutesServices['videoGenerationService']>(
        container,
        'videoGenerationService',
        'preview'
      );
  const continuitySessionService = resolveOptionalService<ContinuitySessionService | null>(
    container,
    'continuitySessionService',
    'continuity'
  );
  const modelIntelligenceService = resolveOptionalService<ModelIntelligenceService | null>(
    container,
    'modelIntelligenceService',
    'model-intelligence'
  );
  const consistentVideoService: ConsistentVideoService | null =
    promptOutputOnly || !videoGenerationService
      ? null
      : resolveOptionalService<ConsistentVideoService | null>(
          container,
          'consistentVideoService',
          'consistent-generation'
        );
  const videoConceptService: VideoConceptServiceContract | null = promptOutputOnly
    ? null
    : resolveOptionalService<VideoConceptServiceContract | null>(
        container,
        'videoConceptService',
        'video-concept'
      );
  const starterCreditsMiddleware = createStarterCreditsMiddleware(userCreditService);

  // ============================================================================
  // Health Routes (no auth required)
  // ============================================================================

  const healthRoutes = createHealthRoutes({
    claudeClient: container.resolve('claudeClient'),
    groqClient: container.resolve('groqClient'),
    geminiClient: container.resolve('geminiClient'),
    cacheService: container.resolve('cacheService'),
    metricsService: container.resolve('metricsService'),
    checkFirestore: async () => { await getFirestore().listCollections(); },
  });

  app.use('/', healthRoutes);

  // ============================================================================
  // Public Preview Routes (no auth required for video content)
  // ============================================================================

  if (!promptOutputOnly) {
    const publicPreviewRoutes = createPublicPreviewRoutes({
      videoGenerationService,
      videoContentAccessService: resolveOptionalService<VideoContentAccessService | null>(
        container,
        'videoContentAccessService',
        'public-preview'
      ),
    });
    app.use('/api/preview', publicPreviewRoutes);

    if (convergenceStorageService) {
      const motionMediaRoutes = createConvergenceMediaRoutes(() => convergenceStorageService);
      app.use('/api/motion/media', motionMediaRoutes);
    } else {
      logger.warn('Convergence media routes disabled: storage service unavailable');
    }
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
    storageService: container.resolve<StorageRoutesService>('storageService'),
    videoConceptService,
    assetService: container.resolve('assetService'),
    ...(consistentVideoService ? { consistentVideoService } : {}),
    userCreditService: container.resolve('userCreditService'),
    referenceImageService: container.resolve('referenceImageService'),
    imageObservationService: container.resolve('imageObservationService'),
    continuitySessionService,
    sessionService: container.resolve('sessionService'),
    modelIntelligenceService,
    modelIntelligenceMetrics: container.resolve('metricsService'),
  });

  app.use('/api', apiAuthMiddleware, apiRoutes);

  // ============================================================================
  // Motion Routes (auth required)
  // ============================================================================

  if (!promptOutputOnly) {
    const motionRoutes = createMotionRoutes({
      cameraPaths: CAMERA_PATHS,
      createDepthEstimationServiceForUser,
      getDepthWarmupStatus,
      getStartupWarmupPromise,
      getStorageService: () => {
        if (!convergenceStorageService) {
          throw new Error('Convergence storage service is not available');
        }
        return convergenceStorageService;
      },
    });
    app.use('/api/motion', apiAuthMiddleware, motionRoutes);
  }

  // ============================================================================
  // LLM Routes (specialized endpoints with auth)
  // ============================================================================

  // Span labeling endpoint (with DI)
  const labelSpansRoute = createLabelSpansRoute(
    container.resolve('aiService'),
    container.resolve('spanLabelingCacheService')
  );
  app.use('/llm/label-spans', apiAuthMiddleware, labelSpansRoute);

  // Batch endpoint for processing multiple span labeling requests
  // Reduces API calls by 60% under concurrent load
  app.post(
    '/llm/label-spans-batch',
    apiAuthMiddleware,
    createBatchMiddleware(container.resolve('aiService'), container.resolve('metricsService'))
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
  const suggestionsRoute = createSuggestionsRoute({
    llmJudgeService: container.resolve<LLMJudgeService>('llmJudgeService'),
  });
  app.use('/api/suggestions', apiAuthMiddleware, suggestionsRoute);

  // ============================================================================
  // Preview Routes (image and video generation)
  // ============================================================================

  if (!promptOutputOnly) {
    const previewRoutes = createPreviewRoutes({
      imageGenerationService: container.resolve('imageGenerationService'),
      storyboardPreviewService: container.resolve('storyboardPreviewService'),
      videoGenerationService,
      videoJobStore: container.resolve('videoJobStore'),
      videoContentAccessService: container.resolve('videoContentAccessService'),
      userCreditService,
      storageService: container.resolve('storageService'),
      keyframeService: container.resolve('keyframeService'),
      faceSwapService: container.resolve('faceSwapService'),
      assetService: container.resolve('assetService'),
    });
    app.use('/api/preview', apiAuthMiddleware, starterCreditsMiddleware, previewRoutes);
  }

  // ============================================================================
  // Payment Routes (auth required)
  // ============================================================================

  const paymentRouteServices: PaymentRouteServices = {
    paymentService: container.resolve<PaymentRouteServices['paymentService']>('paymentService'),
    webhookEventStore: container.resolve<PaymentRouteServices['webhookEventStore']>('stripeWebhookEventStore'),
    billingProfileStore: container.resolve<PaymentRouteServices['billingProfileStore']>('billingProfileStore'),
    userCreditService,
  };
  const paymentRoutes = createPaymentRoutes(paymentRouteServices);
  app.use('/api/payment', apiAuthMiddleware, starterCreditsMiddleware, paymentRoutes);

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
