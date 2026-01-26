/**
 * Convergence Routes
 *
 * Handles all Visual Convergence API endpoints.
 * All routes require authentication via apiAuthMiddleware.
 *
 * Requirements:
 * - 1.8: Require authentication before starting a Convergence_Session
 * - 10.1-10.5: Centralized API layer for convergence operations
 */

import express from 'express';
import type { Request, Response, Router } from 'express';

import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ConvergenceService } from '@services/convergence/ConvergenceService';
import { isConvergenceError } from '@services/convergence/errors';
import type {
  StartSessionRequest,
  SetStartingPointRequest,
  SelectOptionRequest,
  RegenerateRequest,
  GenerateCameraMotionRequest,
  SelectCameraMotionRequest,
  GenerateSubjectMotionRequest,
  GenerateFinalFrameRequest,
  RegenerateFinalFrameRequest,
  AbandonSessionRequest,
} from '@services/convergence/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Express request with authenticated user
 */
interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

/**
 * Services required by convergence routes
 */
export interface ConvergenceRoutesServices {
  convergenceService: ConvergenceService;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract userId from authenticated request.
 * Throws 401 if user is not authenticated.
 *
 * @param req - Express request with user from auth middleware
 * @returns userId string
 * @throws Error with statusCode 401 if not authenticated
 */
function getUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.uid;

  if (!userId) {
    const error = new Error('Authentication required') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  return userId;
}

/**
 * Handle ConvergenceError and send appropriate HTTP response.
 *
 * @param error - The error to handle
 * @param res - Express response object
 * @param requestId - Request ID for logging
 */
function handleConvergenceError(
  error: unknown,
  res: Response,
  requestId?: string
): Response {
  if (isConvergenceError(error)) {
    const status = error.getHttpStatus();
    const message = error.getUserMessage();

    logger.warn('Convergence operation failed', {
      requestId,
      errorCode: error.code,
      status,
      details: error.details,
    });

    return res.status(status).json({
      success: false,
      error: error.code,
      message,
      details: error.details,
      requestId,
    });
  }

  // Re-throw non-ConvergenceError errors to be handled by global error handler
  throw error;
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /start - Start a new convergence session
 *
 * Requirements:
 * - 1.1: Create session with unique identifier
 * - 1.10-1.11: Check for existing active session
 * - 2.1-2.5: Generate direction images
 */
function createStartHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { intent, aspectRatio, forceNew } = req.body as StartSessionRequest & { forceNew?: boolean };

    if (!intent || typeof intent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Intent is required and must be a string',
        requestId,
      });
    }

    logger.info('Starting convergence session', {
      requestId,
      userId,
      intentLength: intent.length,
      aspectRatio,
      forceNew: forceNew ?? false,
    });

    try {
      const request: StartSessionRequest & { forceNew?: boolean } = { intent };
      if (aspectRatio) {
        request.aspectRatio = aspectRatio;
      }
      if (forceNew) {
        request.forceNew = forceNew;
      }
      const result = await convergenceService.startSession(request, userId);

      logger.info('Convergence session started', {
        requestId,
        userId,
        sessionId: result.sessionId,
        imageCount: result.images.length,
      });

      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /starting-point - Set starting point mode
 */
function createStartingPointHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId, mode, imageUrl } = req.body as SetStartingPointRequest;

    if (!sessionId || !mode) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId and mode are required',
        requestId,
      });
    }

    if (mode === 'upload' && !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'imageUrl is required for upload mode',
        requestId,
      });
    }

    logger.info('Setting starting point', {
      requestId,
      userId,
      sessionId,
      mode,
    });

    try {
      const result = await convergenceService.setStartingPoint(
        { sessionId, mode, imageUrl },
        userId
      );

      logger.info('Starting point set', {
        requestId,
        userId,
        sessionId,
        nextStep: result.nextStep,
        creditsConsumed: result.creditsConsumed,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /select - Select an option for a dimension
 *
 * Requirements:
 * - 3.1: Lock dimension and generate next dimension images
 * - 3.2: Incorporate locked dimensions into prompt
 */
function createSelectHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId, dimension, optionId } = req.body as SelectOptionRequest;

    if (!sessionId || !dimension || !optionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId, dimension, and optionId are required',
        requestId,
      });
    }

    logger.info('Selecting option', {
      requestId,
      userId,
      sessionId,
      dimension,
      optionId,
    });

    try {
      const result = await convergenceService.selectOption(
        { sessionId, dimension, optionId },
        userId
      );

      logger.info('Option selected', {
        requestId,
        userId,
        sessionId,
        currentDimension: result.currentDimension,
        imageCount: result.images.length,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /regenerate - Regenerate options for a dimension
 *
 * Requirements:
 * - 14.1-14.5: Regeneration with limit tracking
 */
function createRegenerateHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId, dimension } = req.body as RegenerateRequest;

    if (!sessionId || !dimension) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId and dimension are required',
        requestId,
      });
    }

    logger.info('Regenerating dimension', {
      requestId,
      userId,
      sessionId,
      dimension,
    });

    try {
      const result = await convergenceService.regenerate({ sessionId, dimension }, userId);

      logger.info('Dimension regenerated', {
        requestId,
        userId,
        sessionId,
        imageCount: result.images.length,
        remainingRegenerations: result.remainingRegenerations,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /final-frame/generate - Generate HQ final frame
 */
function createGenerateFinalFrameHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId } = req.body as GenerateFinalFrameRequest;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId is required',
        requestId,
      });
    }

    logger.info('Generating final frame', {
      requestId,
      userId,
      sessionId,
    });

    try {
      const result = await convergenceService.generateFinalFrame({ sessionId }, userId);

      logger.info('Final frame generated', {
        requestId,
        userId,
        sessionId,
        creditsConsumed: result.creditsConsumed,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /final-frame/regenerate - Regenerate HQ final frame
 */
function createRegenerateFinalFrameHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId } = req.body as RegenerateFinalFrameRequest;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId is required',
        requestId,
      });
    }

    logger.info('Regenerating final frame', {
      requestId,
      userId,
      sessionId,
    });

    try {
      const result = await convergenceService.regenerateFinalFrame({ sessionId }, userId);

      logger.info('Final frame regenerated', {
        requestId,
        userId,
        sessionId,
        creditsConsumed: result.creditsConsumed,
        remainingRegenerations: result.remainingRegenerations,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /camera-motion - Generate camera motion options with depth map
 *
 * Requirements:
 * - 5.1-5.5: Depth estimation and camera path options
 */
function createCameraMotionHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId } = req.body as GenerateCameraMotionRequest;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId is required',
        requestId,
      });
    }

    logger.info('Generating camera motion options', {
      requestId,
      userId,
      sessionId,
    });

    try {
      const result = await convergenceService.generateCameraMotion({ sessionId }, userId);

      logger.info('Camera motion options generated', {
        requestId,
        userId,
        sessionId,
        fallbackMode: result.fallbackMode,
        hasDepthMap: Boolean(result.depthMapUrl),
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /camera-motion/select - Select a camera motion option
 *
 * Requirements:
 * - 11.2: Lock camera motion selection in session
 */
function createCameraMotionSelectHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId, cameraMotionId } = req.body as SelectCameraMotionRequest;

    if (!sessionId || !cameraMotionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId and cameraMotionId are required',
        requestId,
      });
    }

    logger.info('Selecting camera motion', {
      requestId,
      userId,
      sessionId,
      cameraMotionId,
    });

    try {
      await convergenceService.selectCameraMotion({ sessionId, cameraMotionId }, userId);

      logger.info('Camera motion selected', {
        requestId,
        userId,
        sessionId,
        cameraMotionId,
      });

      return res.status(200).json({
        success: true,
        sessionId,
        cameraMotionId,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /subject-motion - Generate subject motion preview
 *
 * Requirements:
 * - 7.1-7.7: Subject motion preview generation
 */
function createSubjectMotionHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId, subjectMotion } = req.body as GenerateSubjectMotionRequest;

    if (!sessionId || typeof subjectMotion !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId and subjectMotion are required',
        requestId,
      });
    }

    logger.info('Generating subject motion preview', {
      requestId,
      userId,
      sessionId,
      subjectMotionLength: subjectMotion.length,
    });

    try {
      const result = await convergenceService.generateSubjectMotion(
        { sessionId, subjectMotion },
        userId
      );

      logger.info('Subject motion preview generated', {
        requestId,
        userId,
        sessionId,
        hasVideo: Boolean(result.videoUrl),
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /finalize - Finalize the convergence session
 *
 * Requirements:
 * - 8.1-8.7: Session finalization
 */
function createFinalizeHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId } = req.body as { sessionId: string };

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId is required',
        requestId,
      });
    }

    logger.info('Finalizing session', {
      requestId,
      userId,
      sessionId,
    });

    try {
      const result = await convergenceService.finalizeSession(sessionId, userId);

      logger.info('Session finalized', {
        requestId,
        userId,
        sessionId,
        totalCreditsConsumed: result.totalCreditsConsumed,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * GET /session/active - Get active session for resume flow
 *
 * Requirements:
 * - 1.6: Resume incomplete sessions from previous visits
 */
function createGetActiveSessionHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    logger.info('Getting active session', {
      requestId,
      userId,
    });

    try {
      const session = await convergenceService.getActiveSession(userId);

      if (!session) {
        return res.status(200).json({
          success: true,
          session: null,
        });
      }

      logger.info('Active session found', {
        requestId,
        userId,
        sessionId: session.id,
        currentStep: session.currentStep,
      });

      return res.status(200).json({
        success: true,
        session,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * GET /session/:sessionId - Get session by ID with ownership validation
 *
 * Requirement 1.3: Allow retrieval of session by identifier
 */
function createGetSessionHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);
    const sessionId = req.params.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId is required',
        requestId,
      });
    }

    logger.info('Getting session by ID', {
      requestId,
      userId,
      sessionId,
    });

    try {
      const session = await convergenceService.getSessionForUser(sessionId, userId);

      return res.status(200).json({
        success: true,
        session,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

/**
 * POST /session/abandon - Abandon an existing session
 *
 * Allows users to explicitly abandon their active session so they can start fresh.
 * Optionally cleans up associated images from GCS storage.
 */
function createAbandonSessionHandler(convergenceService: ConvergenceService) {
  return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const requestId = (req as Request & { id?: string }).id;
    const userId = getUserId(req);

    const { sessionId, deleteImages } = req.body as AbandonSessionRequest;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'sessionId is required and must be a string',
        requestId,
      });
    }

    logger.info('Abandoning session', {
      requestId,
      userId,
      sessionId,
      deleteImages: deleteImages ?? false,
    });

    try {
      const result = await convergenceService.abandonSession(sessionId, userId, {
        deleteImages: deleteImages ?? false,
      });

      logger.info('Session abandoned', {
        requestId,
        userId,
        sessionId,
        imagesDeleted: result.imagesDeleted,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleConvergenceError(error, res, requestId);
    }
  };
}

// ============================================================================
// Route Factory
// ============================================================================

/**
 * Create convergence routes with all handlers.
 *
 * Note: authMiddleware is applied at the app level in routes.config.ts,
 * so all routes in this router are already authenticated.
 *
 * @param services - Services required by convergence routes
 * @returns Express Router with all convergence routes
 */
export function createConvergenceRoutes(services: ConvergenceRoutesServices): Router {
  const router = express.Router();
  const { convergenceService } = services;

  // Session lifecycle
  router.post('/start', asyncHandler(createStartHandler(convergenceService)));
  router.post('/starting-point', asyncHandler(createStartingPointHandler(convergenceService)));
  router.post(
    '/final-frame/generate',
    asyncHandler(createGenerateFinalFrameHandler(convergenceService))
  );
  router.post(
    '/final-frame/regenerate',
    asyncHandler(createRegenerateFinalFrameHandler(convergenceService))
  );
  router.post('/finalize', asyncHandler(createFinalizeHandler(convergenceService)));
  router.get('/session/active', asyncHandler(createGetActiveSessionHandler(convergenceService)));
  router.get('/session/:sessionId', asyncHandler(createGetSessionHandler(convergenceService)));
  router.post('/session/abandon', asyncHandler(createAbandonSessionHandler(convergenceService)));

  // Dimension selection
  router.post('/select', asyncHandler(createSelectHandler(convergenceService)));
  router.post('/regenerate', asyncHandler(createRegenerateHandler(convergenceService)));

  // Camera motion
  router.post('/camera-motion', asyncHandler(createCameraMotionHandler(convergenceService)));
  router.post(
    '/camera-motion/select',
    asyncHandler(createCameraMotionSelectHandler(convergenceService))
  );

  // Subject motion
  router.post('/subject-motion', asyncHandler(createSubjectMotionHandler(convergenceService)));

  return router;
}

export default createConvergenceRoutes;
