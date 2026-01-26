/**
 * ConvergenceService - Main orchestrator for Visual Convergence feature
 *
 * Coordinates all convergence operations including session management,
 * image generation, depth estimation, and video preview generation.
 *
 * Requirements:
 * - 1.1: Session created with unique identifier and persisted to Firestore
 * - 1.6: Resume incomplete sessions from previous visits
 * - 1.7: Store generated images in permanent storage (GCS)
 * - 1.8: Require authentication before starting a session
 * - 1.10-1.11: Only ONE active session per user at a time
 * - 2.1-2.5: Direction fork with parallel image generation
 * - 15.6: Reserve credits at request time and refund on failure
 *
 * @module convergence
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type {
  ConvergenceSession,
  GeneratedImage,
  StartSessionRequest,
  StartSessionResponse,
  SelectOptionRequest,
  SelectOptionResponse,
  RegenerateRequest,
  RegenerateResponse,
  GenerateCameraMotionRequest,
  GenerateCameraMotionResponse,
  SelectCameraMotionRequest,
  GenerateSubjectMotionRequest,
  GenerateSubjectMotionResponse,
  FinalizeSessionResponse,
  DimensionType,
  Direction,
  LockedDimension,
} from './types';
import { ConvergenceError } from './errors';
import { DIRECTION_OPTIONS, CONVERGENCE_COSTS, MAX_REGENERATIONS_PER_DIMENSION, CAMERA_PATHS, GENERATION_COSTS } from './constants';
import { withRetry, getNextDimension, dimensionToStep } from './helpers';
import type { SessionStore } from './session/SessionStore';
import type { PromptBuilderService } from './prompt-builder/PromptBuilderService';
import type { CreditsService } from './credits/CreditsService';
import type { StorageService } from './storage/StorageService';
import type { DepthEstimationService } from './depth/DepthEstimationService';
import type { VideoPreviewService } from './video-preview/VideoPreviewService';
import { withCreditReservation } from './credits/creditHelpers';
import { getDimensionConfig, getDimensionOption } from './prompt-builder/DimensionFragments';

// ============================================================================
// Types
// ============================================================================

/**
 * Dependencies required by ConvergenceService
 */
export interface ConvergenceServiceDeps {
  imageGenerationService: ImageGenerationService;
  depthEstimationService: DepthEstimationService;
  sessionStore: SessionStore;
  promptBuilder: PromptBuilderService;
  creditsService: CreditsService;
  storageService: StorageService;
  videoPreviewService?: VideoPreviewService;
}

/**
 * Prompt info for image generation
 */
interface PromptInfo {
  prompt: string;
  dimension: string;
  optionId: string;
}

// ============================================================================
// ConvergenceService Implementation
// ============================================================================

/**
 * Main orchestrator service for Visual Convergence feature.
 *
 * Coordinates session management, image generation, depth estimation,
 * and video preview generation with credit reservation pattern.
 */
export class ConvergenceService {
  private readonly log = logger.child({ service: 'ConvergenceService' });
  private readonly imageGen: ImageGenerationService;
  private readonly depth: DepthEstimationService;
  private readonly sessions: SessionStore;
  private readonly promptBuilder: PromptBuilderService;
  private readonly credits: CreditsService;
  private readonly storage: StorageService;
  private readonly videoPreview: VideoPreviewService | undefined;

  constructor(deps: ConvergenceServiceDeps) {
    this.imageGen = deps.imageGenerationService;
    this.depth = deps.depthEstimationService;
    this.sessions = deps.sessionStore;
    this.promptBuilder = deps.promptBuilder;
    this.credits = deps.creditsService;
    this.storage = deps.storageService;
    this.videoPreview = deps.videoPreviewService;
  }

  // ==========================================================================
  // Session Lifecycle Methods
  // ==========================================================================

  /**
   * Start a new convergence session.
   *
   * Requirements:
   * - 1.10-1.11: Check for existing active session (throw ACTIVE_SESSION_EXISTS)
   * - 1.1: Create session in Firestore
   * - 15.6: Reserve credits and generate direction images
   * - 1.7: Upload to GCS and update session
   *
   * @param request - Start session request with intent and optional aspectRatio
   * @param userId - Firebase Auth UID from auth middleware
   * @returns StartSessionResponse with sessionId, images, and options
   * @throws ConvergenceError('ACTIVE_SESSION_EXISTS') if user has active session
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if user lacks credits
   */
  async startSession(
    request: StartSessionRequest,
    userId: string
  ): Promise<StartSessionResponse> {
    this.log.info('Starting new convergence session', {
      userId,
      intentLength: request.intent.length,
      aspectRatio: request.aspectRatio,
    });

    // Check for existing active session (Requirement 1.10-1.11)
    const existing = await this.sessions.getActiveByUserId(userId);
    if (existing) {
      this.log.warn('User already has active session', {
        userId,
        existingSessionId: existing.id,
      });
      throw new ConvergenceError('ACTIVE_SESSION_EXISTS', { sessionId: existing.id });
    }

    const sessionId = uuidv4();

    // Create session first (Requirement 1.1)
    const session: ConvergenceSession = {
      id: sessionId,
      userId,
      intent: request.intent,
      direction: null,
      lockedDimensions: [],
      currentStep: 'direction',
      generatedImages: [],
      imageHistory: {},
      regenerationCounts: {},
      depthMapUrl: null,
      cameraMotion: null,
      subjectMotion: null,
      finalPrompt: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.sessions.create(session);

    this.log.debug('Session created in Firestore', { sessionId });

    // Generate direction images with credit reservation (Requirement 15.6)
    const directionPrompts = this.promptBuilder.buildDirectionPrompts(request.intent);
    const estimatedCost = CONVERGENCE_COSTS.DIRECTION_IMAGES;

    try {
      const images = await withCreditReservation(
        this.credits,
        userId,
        estimatedCost,
        async () => {
          return this.generateAndPersistImages(
            directionPrompts.map((d) => ({
              prompt: d.prompt,
              dimension: 'direction',
              optionId: d.direction,
            })),
            userId,
            request.aspectRatio
          );
        }
      );

      // Update session with images (Requirement 1.7)
      await this.sessions.update(sessionId, {
        generatedImages: images,
        imageHistory: { direction: images },
      });

      this.log.info('Session started successfully', {
        sessionId,
        userId,
        imageCount: images.length,
        creditsConsumed: estimatedCost,
      });

      return {
        sessionId,
        images,
        currentDimension: 'direction',
        options: DIRECTION_OPTIONS,
        estimatedCost,
      };
    } catch (error) {
      // If image generation fails, mark session as abandoned
      this.log.error('Failed to generate direction images', error as Error, {
        sessionId,
        userId,
      });

      await this.sessions.update(sessionId, { status: 'abandoned' });

      throw error;
    }
  }

  /**
   * Get a session by ID.
   *
   * Requirement 1.3: Allow retrieval of session by identifier
   *
   * @param sessionId - Session UUID
   * @returns ConvergenceSession or null if not found
   */
  async getSession(sessionId: string): Promise<ConvergenceSession | null> {
    return this.sessions.get(sessionId);
  }

  /**
   * Get the active session for a user (for resume flow).
   *
   * Requirement 1.6: Resume incomplete sessions from previous visits
   *
   * @param userId - Firebase Auth UID
   * @returns Active ConvergenceSession or null if none exists
   */
  async getActiveSession(userId: string): Promise<ConvergenceSession | null> {
    return this.sessions.getActiveByUserId(userId);
  }

  // ==========================================================================
  // Dimension Selection Methods
  // ==========================================================================

  /**
   * Select an option for a dimension (direction or mood/framing/lighting).
   *
   * Requirements:
   * - 3.1: When user selects dimension option, lock that dimension and generate images for next dimension
   * - 3.2: Incorporate all previously locked dimensions into the prompt
   * - 3.5: Process dimensions in order: mood → framing → lighting → camera_motion
   * - 3.6: When lighting is locked, transition to camera motion selection
   *
   * @param request - SelectOptionRequest with sessionId, dimension, and optionId
   * @param userId - Firebase Auth UID from auth middleware
   * @returns SelectOptionResponse with images, currentDimension, lockedDimensions, and creditsConsumed
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if user lacks credits
   */
  async selectOption(
    request: SelectOptionRequest,
    userId: string
  ): Promise<SelectOptionResponse> {
    const { sessionId, dimension, optionId } = request;

    this.log.info('Selecting option', {
      sessionId,
      userId,
      dimension,
      optionId,
    });

    // 9.1: Validate session ownership
    const session = await this.getSessionWithOwnershipCheck(sessionId, userId);

    // Branch based on whether this is direction or a dimension selection
    if (dimension === 'direction') {
      return this.handleDirectionSelection(session, optionId, userId);
    } else {
      return this.handleDimensionSelection(session, dimension, optionId, userId);
    }
  }

  /**
   * Handle direction selection (9.2).
   *
   * @param session - Current convergence session
   * @param optionId - Selected direction ID
   * @param userId - Firebase Auth UID
   * @returns SelectOptionResponse with mood dimension images
   */
  private async handleDirectionSelection(
    session: ConvergenceSession,
    optionId: string,
    userId: string
  ): Promise<SelectOptionResponse> {
    const direction = optionId as Direction;

    this.log.debug('Handling direction selection', {
      sessionId: session.id,
      direction,
    });

    // 9.2.2: Generate mood dimension images
    const moodConfig = getDimensionConfig('mood');
    if (!moodConfig) {
      throw new Error('Mood dimension configuration not found');
    }

    const estimatedCost = CONVERGENCE_COSTS.DIMENSION_IMAGES;

    // Build prompts for each mood option
    const moodPrompts = moodConfig.options.map((option) => ({
      prompt: this.promptBuilder.buildDimensionPreviewPrompt(
        session.intent,
        direction,
        [], // No locked dimensions yet
        {
          type: 'mood',
          optionId: option.id,
          fragments: option.promptFragments,
        }
      ),
      dimension: 'mood' as const,
      optionId: option.id,
    }));

    // Generate images with credit reservation
    const images = await withCreditReservation(
      this.credits,
      userId,
      estimatedCost,
      async () => {
        return this.generateAndPersistImages(moodPrompts, userId);
      }
    );

    // 9.2.1: Lock direction in session
    // 9.2.3: Update session with direction and images
    await this.sessions.update(session.id, {
      direction,
      currentStep: 'mood',
      generatedImages: images,
      imageHistory: {
        ...session.imageHistory,
        mood: images,
      },
    });

    this.log.info('Direction selected successfully', {
      sessionId: session.id,
      direction,
      imageCount: images.length,
      creditsConsumed: estimatedCost,
    });

    // Build options for the response
    const options = moodConfig.options.map((o) => ({
      id: o.id,
      label: o.label,
    }));

    return {
      sessionId: session.id,
      images,
      currentDimension: 'mood',
      lockedDimensions: [],
      options,
      creditsConsumed: estimatedCost,
      direction, // 9.2.3: Return response with direction field set
    };
  }

  /**
   * Handle dimension selection for mood, framing, or lighting (9.3).
   *
   * @param session - Current convergence session
   * @param dimension - The dimension being selected
   * @param optionId - Selected option ID
   * @param userId - Firebase Auth UID
   * @returns SelectOptionResponse with next dimension images or camera_motion transition
   */
  private async handleDimensionSelection(
    session: ConvergenceSession,
    dimension: DimensionType,
    optionId: string,
    userId: string
  ): Promise<SelectOptionResponse> {
    this.log.debug('Handling dimension selection', {
      sessionId: session.id,
      dimension,
      optionId,
    });

    // Get the selected option details
    const selectedOption = getDimensionOption(dimension, optionId);
    if (!selectedOption) {
      throw new Error(`Option ${optionId} not found for dimension ${dimension}`);
    }

    // Ensure direction is set
    if (!session.direction) {
      throw new Error('Direction must be selected before selecting dimensions');
    }

    // 9.3.1: Create the new locked dimension
    const newLockedDimension: LockedDimension = {
      type: dimension,
      optionId: selectedOption.id,
      label: selectedOption.label,
      promptFragments: selectedOption.promptFragments,
    };

    // Build updated locked dimensions array (replace if same dimension exists, otherwise add)
    const updatedLockedDimensions = [
      ...session.lockedDimensions.filter((d) => d.type !== dimension),
      newLockedDimension,
    ];

    // Get the next dimension in the flow
    const nextDimension = getNextDimension(dimension);

    // 3.6: When lighting is locked, transition to camera_motion (no image generation)
    if (dimension === 'lighting' || nextDimension === 'camera_motion') {
      return this.transitionToCameraMotion(
        session,
        updatedLockedDimensions,
        newLockedDimension
      );
    }

    // 9.3.2: Generate next dimension images
    const nextDimensionConfig = getDimensionConfig(nextDimension!);
    if (!nextDimensionConfig) {
      throw new Error(`Dimension configuration not found for ${nextDimension}`);
    }

    const estimatedCost = CONVERGENCE_COSTS.DIMENSION_IMAGES;

    // Build prompts for each option in the next dimension
    const nextDimensionPrompts = nextDimensionConfig.options.map((option) => ({
      prompt: this.promptBuilder.buildDimensionPreviewPrompt(
        session.intent,
        session.direction!, // Already validated above
        updatedLockedDimensions,
        {
          type: nextDimension!,
          optionId: option.id,
          fragments: option.promptFragments,
        }
      ),
      dimension: nextDimension!,
      optionId: option.id,
    }));

    // Generate images with credit reservation
    const images = await withCreditReservation(
      this.credits,
      userId,
      estimatedCost,
      async () => {
        return this.generateAndPersistImages(nextDimensionPrompts, userId);
      }
    );

    // 9.3.3: Update imageHistory for back navigation
    const nextStep = dimensionToStep(nextDimension!);
    await this.sessions.update(session.id, {
      lockedDimensions: updatedLockedDimensions,
      currentStep: nextStep,
      generatedImages: images,
      imageHistory: {
        ...session.imageHistory,
        [nextDimension!]: images,
      },
    });

    this.log.info('Dimension selected successfully', {
      sessionId: session.id,
      dimension,
      optionId,
      nextDimension,
      imageCount: images.length,
      creditsConsumed: estimatedCost,
    });

    // Build options for the response
    const options = nextDimensionConfig.options.map((o) => ({
      id: o.id,
      label: o.label,
    }));

    return {
      sessionId: session.id,
      images,
      currentDimension: nextDimension!,
      lockedDimensions: updatedLockedDimensions,
      options,
      creditsConsumed: estimatedCost,
    };
  }

  /**
   * Transition to camera motion step (no image generation).
   *
   * Requirement 3.6: When lighting is locked, transition to camera motion selection.
   *
   * @param session - Current convergence session
   * @param lockedDimensions - Updated locked dimensions including lighting
   * @param newLockedDimension - The newly locked dimension (lighting)
   * @returns SelectOptionResponse with camera_motion as currentDimension
   */
  private async transitionToCameraMotion(
    session: ConvergenceSession,
    lockedDimensions: LockedDimension[],
    newLockedDimension: LockedDimension
  ): Promise<SelectOptionResponse> {
    this.log.debug('Transitioning to camera motion', {
      sessionId: session.id,
    });

    // Update session to camera_motion step
    await this.sessions.update(session.id, {
      lockedDimensions,
      currentStep: 'camera_motion',
    });

    this.log.info('Transitioned to camera motion', {
      sessionId: session.id,
      lockedDimensionCount: lockedDimensions.length,
    });

    // Return response with empty images (camera motion uses depth-based rendering)
    return {
      sessionId: session.id,
      images: [], // No images generated for camera_motion step
      currentDimension: 'camera_motion',
      lockedDimensions,
      creditsConsumed: 0, // No credits consumed for transition
    };
  }

  // ==========================================================================
  // Regeneration Methods
  // ==========================================================================

  /**
   * Regenerate options for a dimension with shuffled fragment selection.
   *
   * Requirements:
   * - 14.1: Display a "Regenerate" control when viewing dimension options
   * - 14.2: Generate new images for all options in the current dimension
   * - 14.3: Shuffle which 2 of 5 prompt fragments are selected
   * - 14.4: Limit regeneration to 3 times per dimension per session
   * - 14.5: Display remaining regeneration count to the user
   *
   * @param request - RegenerateRequest with sessionId and dimension
   * @param userId - Firebase Auth UID from auth middleware
   * @returns RegenerateResponse with new images and remaining regenerations
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   * @throws ConvergenceError('REGENERATION_LIMIT_EXCEEDED') if limit reached
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if user lacks credits
   */
  async regenerate(
    request: RegenerateRequest,
    userId: string
  ): Promise<RegenerateResponse> {
    const { sessionId, dimension } = request;

    this.log.info('Regenerating dimension options', {
      sessionId,
      userId,
      dimension,
    });

    // 10.1: Validate session ownership
    const session = await this.getSessionWithOwnershipCheck(sessionId, userId);

    // 10.2: Check regeneration limit (max 3 per dimension)
    const currentCount = session.regenerationCounts[dimension] ?? 0;
    if (currentCount >= MAX_REGENERATIONS_PER_DIMENSION) {
      this.log.warn('Regeneration limit exceeded', {
        sessionId,
        dimension,
        currentCount,
        maxAllowed: MAX_REGENERATIONS_PER_DIMENSION,
      });
      throw new ConvergenceError('REGENERATION_LIMIT_EXCEEDED', {
        dimension,
        currentCount,
        maxAllowed: MAX_REGENERATIONS_PER_DIMENSION,
      });
    }

    // Branch based on whether this is direction or a dimension regeneration
    if (dimension === 'direction') {
      return this.handleDirectionRegeneration(session, userId, currentCount);
    } else {
      return this.handleDimensionRegeneration(session, dimension, userId, currentCount);
    }
  }

  /**
   * Handle direction regeneration with shuffled fragments.
   *
   * @param session - Current convergence session
   * @param userId - Firebase Auth UID
   * @param currentCount - Current regeneration count for direction
   * @returns RegenerateResponse with new direction images
   */
  private async handleDirectionRegeneration(
    session: ConvergenceSession,
    userId: string,
    currentCount: number
  ): Promise<RegenerateResponse> {
    this.log.debug('Handling direction regeneration', {
      sessionId: session.id,
      currentCount,
    });

    // 10.3: Shuffle fragment selection for variety using buildRegeneratedDirectionPrompts
    const directionPrompts = this.promptBuilder.buildRegeneratedDirectionPrompts(session.intent);
    const estimatedCost = CONVERGENCE_COSTS.REGENERATION;

    // 10.4: Generate new images with credit reservation
    const images = await withCreditReservation(
      this.credits,
      userId,
      estimatedCost,
      async () => {
        return this.generateAndPersistImages(
          directionPrompts.map((d) => ({
            prompt: d.prompt,
            dimension: 'direction',
            optionId: d.direction,
          })),
          userId
        );
      }
    );

    // 10.5: Update regenerationCounts in session
    const newCount = currentCount + 1;
    const remainingRegenerations = MAX_REGENERATIONS_PER_DIMENSION - newCount;

    await this.sessions.update(session.id, {
      generatedImages: images,
      imageHistory: {
        ...session.imageHistory,
        direction: images,
      },
      regenerationCounts: {
        ...session.regenerationCounts,
        direction: newCount,
      },
    });

    this.log.info('Direction regenerated successfully', {
      sessionId: session.id,
      imageCount: images.length,
      creditsConsumed: estimatedCost,
      remainingRegenerations,
    });

    return {
      sessionId: session.id,
      images,
      remainingRegenerations,
      creditsConsumed: estimatedCost,
    };
  }

  /**
   * Handle dimension regeneration (mood, framing, lighting) with shuffled fragments.
   *
   * @param session - Current convergence session
   * @param dimension - The dimension being regenerated
   * @param userId - Firebase Auth UID
   * @param currentCount - Current regeneration count for this dimension
   * @returns RegenerateResponse with new dimension images
   */
  private async handleDimensionRegeneration(
    session: ConvergenceSession,
    dimension: DimensionType,
    userId: string,
    currentCount: number
  ): Promise<RegenerateResponse> {
    this.log.debug('Handling dimension regeneration', {
      sessionId: session.id,
      dimension,
      currentCount,
    });

    // Ensure direction is set
    if (!session.direction) {
      throw new Error('Direction must be selected before regenerating dimensions');
    }

    // Get the dimension configuration
    const dimensionConfig = getDimensionConfig(dimension);
    if (!dimensionConfig) {
      throw new Error(`Dimension configuration not found for ${dimension}`);
    }

    const estimatedCost = CONVERGENCE_COSTS.REGENERATION;

    // 10.3: Build prompts with shuffled fragment selection for variety
    const dimensionPrompts = dimensionConfig.options.map((option) => ({
      prompt: this.promptBuilder.buildRegeneratedDimensionPreviewPrompt(
        session.intent,
        session.direction!,
        session.lockedDimensions,
        {
          type: dimension,
          optionId: option.id,
          fragments: option.promptFragments,
        }
      ),
      dimension,
      optionId: option.id,
    }));

    // 10.4: Generate new images with credit reservation
    const images = await withCreditReservation(
      this.credits,
      userId,
      estimatedCost,
      async () => {
        return this.generateAndPersistImages(dimensionPrompts, userId);
      }
    );

    // 10.5: Update regenerationCounts in session
    const newCount = currentCount + 1;
    const remainingRegenerations = MAX_REGENERATIONS_PER_DIMENSION - newCount;

    await this.sessions.update(session.id, {
      generatedImages: images,
      imageHistory: {
        ...session.imageHistory,
        [dimension]: images,
      },
      regenerationCounts: {
        ...session.regenerationCounts,
        [dimension]: newCount,
      },
    });

    this.log.info('Dimension regenerated successfully', {
      sessionId: session.id,
      dimension,
      imageCount: images.length,
      creditsConsumed: estimatedCost,
      remainingRegenerations,
    });

    return {
      sessionId: session.id,
      images,
      remainingRegenerations,
      creditsConsumed: estimatedCost,
    };
  }

  // ==========================================================================
  // Camera Motion Methods
  // ==========================================================================

  /**
   * Generate camera motion options with depth map.
   *
   * Requirements:
   * - 5.1: Generate depth map from last generated image using Depth Anything v2
   * - 5.3: Return depth map URL and available camera paths
   * - 5.4: Provide at least 6 camera path options
   * - 5.5: If depth estimation fails, offer text-only camera motion selection as fallback
   *
   * @param request - GenerateCameraMotionRequest with sessionId
   * @param userId - Firebase Auth UID from auth middleware
   * @returns GenerateCameraMotionResponse with depthMapUrl, cameraPaths, and fallbackMode
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   */
  async generateCameraMotion(
    request: GenerateCameraMotionRequest,
    userId: string
  ): Promise<GenerateCameraMotionResponse> {
    const { sessionId } = request;

    this.log.info('Generating camera motion options', {
      sessionId,
      userId,
    });

    // Validate session ownership
    const session = await this.getSessionWithOwnershipCheck(sessionId, userId);

    // 11.1.1: Get last generated image
    const lastImage = session.generatedImages[session.generatedImages.length - 1];
    if (!lastImage) {
      this.log.error('No generated images found for camera motion', undefined, {
        sessionId,
      });
      throw new Error('No generated images found in session');
    }

    this.log.debug('Using last generated image for depth estimation', {
      sessionId,
      imageId: lastImage.id,
      imageUrl: lastImage.url,
    });

    let depthMapUrl: string | null = null;
    let fallbackMode = false;
    let creditsConsumed = 0;

    try {
      // 11.1.2: Call DepthEstimationService with retry (retry is built into the service)
      depthMapUrl = await withCreditReservation(
        this.credits,
        userId,
        CONVERGENCE_COSTS.DEPTH_ESTIMATION,
        async () => {
          return this.depth.estimateDepth(lastImage.url);
        }
      );

      creditsConsumed = CONVERGENCE_COSTS.DEPTH_ESTIMATION;

      // Update session with depth map URL
      await this.sessions.update(sessionId, {
        depthMapUrl,
      });

      this.log.info('Depth estimation completed successfully', {
        sessionId,
        depthMapUrl,
        creditsConsumed,
      });
    } catch (error) {
      // 11.1.3: On failure: return fallbackMode=true with null depthMapUrl
      this.log.warn('Depth estimation failed, using fallback mode', {
        sessionId,
        error: (error as Error).message,
      });

      fallbackMode = true;
      depthMapUrl = null;
      // No credits consumed on failure (withCreditReservation handles refund)
    }

    // 11.1.4: Return cameraPaths constant
    return {
      sessionId,
      depthMapUrl,
      cameraPaths: CAMERA_PATHS,
      fallbackMode,
      creditsConsumed,
    };
  }

  /**
   * Select a camera motion option and lock it in the session.
   *
   * Requirement 11.2: Lock camera motion selection in session
   *
   * @param request - SelectCameraMotionRequest with sessionId and cameraMotionId
   * @param userId - Firebase Auth UID from auth middleware
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   */
  async selectCameraMotion(
    request: SelectCameraMotionRequest,
    userId: string
  ): Promise<void> {
    const { sessionId, cameraMotionId } = request;

    this.log.info('Selecting camera motion', {
      sessionId,
      userId,
      cameraMotionId,
    });

    // Validate session ownership
    const session = await this.getSessionWithOwnershipCheck(sessionId, userId);

    // Validate that the camera motion ID is valid
    const validCameraMotion = CAMERA_PATHS.find((path) => path.id === cameraMotionId);
    if (!validCameraMotion) {
      this.log.warn('Invalid camera motion ID', {
        sessionId,
        cameraMotionId,
        validIds: CAMERA_PATHS.map((p) => p.id),
      });
      throw new Error(`Invalid camera motion ID: ${cameraMotionId}`);
    }

    // Lock the camera motion selection in the session
    await this.sessions.update(sessionId, {
      cameraMotion: cameraMotionId,
      currentStep: 'subject_motion',
    });

    this.log.info('Camera motion selected successfully', {
      sessionId,
      cameraMotionId,
      cameraMotionLabel: validCameraMotion.label,
    });
  }

  // ==========================================================================
  // Subject Motion Methods
  // ==========================================================================

  /**
   * Generate a subject motion preview video using Wan 2.2.
   *
   * Requirements:
   * - 7.2: Generate a Wan 2.2 preview video when user enters subject motion text
   * - 7.3: Use full prompt including all locked dimensions and subject motion
   * - 7.5: Store the final prompt in the session
   *
   * @param request - GenerateSubjectMotionRequest with sessionId and subjectMotion
   * @param userId - Firebase Auth UID from auth middleware
   * @returns GenerateSubjectMotionResponse with videoUrl, prompt, and creditsConsumed
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if user lacks credits
   */
  async generateSubjectMotion(
    request: GenerateSubjectMotionRequest,
    userId: string
  ): Promise<GenerateSubjectMotionResponse> {
    const { sessionId, subjectMotion } = request;

    this.log.info('Generating subject motion preview', {
      sessionId,
      userId,
      subjectMotionLength: subjectMotion.length,
    });

    // Validate session ownership
    const session = await this.getSessionWithOwnershipCheck(sessionId, userId);

    // Ensure direction is set
    if (!session.direction) {
      throw new Error('Direction must be selected before generating subject motion');
    }

    // Check if video preview service is available
    if (!this.videoPreview) {
      throw new Error('Video preview service is not available');
    }

    // 11.3.1: Build full prompt with all locked dimensions
    const fullPrompt = this.promptBuilder.buildPrompt({
      intent: session.intent,
      direction: session.direction,
      lockedDimensions: session.lockedDimensions,
      subjectMotion,
    });

    this.log.debug('Built full prompt for subject motion', {
      sessionId,
      promptLength: fullPrompt.length,
    });

    // 11.3.2: Call VideoPreviewService with credit reservation
    const videoUrl = await withCreditReservation(
      this.credits,
      userId,
      CONVERGENCE_COSTS.WAN_PREVIEW,
      async () => {
        return this.videoPreview!.generatePreview(fullPrompt);
      }
    );

    // 11.3.3: Store finalPrompt and subjectMotion in session
    await this.sessions.update(sessionId, {
      subjectMotion,
      finalPrompt: fullPrompt,
      currentStep: 'preview',
    });

    this.log.info('Subject motion preview generated successfully', {
      sessionId,
      videoUrl,
      creditsConsumed: CONVERGENCE_COSTS.WAN_PREVIEW,
    });

    return {
      sessionId,
      videoUrl,
      prompt: fullPrompt,
      creditsConsumed: CONVERGENCE_COSTS.WAN_PREVIEW,
    };
  }

  // ==========================================================================
  // Session Finalization Methods
  // ==========================================================================

  /**
   * Finalize a convergence session.
   *
   * Requirements:
   * - 8.1: Return complete prompt, locked dimensions, preview image URL, camera motion, and subject motion
   * - 8.2: Mark session as completed
   * - 8.3: Validate that direction, mood, framing, lighting, and camera motion have been selected
   * - 8.4: Return error indicating missing selections if session is incomplete
   *
   * @param sessionId - Session UUID
   * @param userId - Firebase Auth UID from auth middleware
   * @returns FinalizeSessionResponse with all session data
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   * @throws ConvergenceError('INCOMPLETE_SESSION') if required selections are missing
   */
  async finalizeSession(
    sessionId: string,
    userId: string
  ): Promise<FinalizeSessionResponse> {
    this.log.info('Finalizing session', {
      sessionId,
      userId,
    });

    // Validate session ownership
    const session = await this.getSessionWithOwnershipCheck(sessionId, userId);

    // 11.4.1: Validate all required dimensions are locked
    const requiredDimensions: DimensionType[] = ['mood', 'framing', 'lighting'];
    const lockedTypes = new Set(session.lockedDimensions.map((d) => d.type));

    const missing: string[] = [];

    // Check direction
    if (!session.direction) {
      missing.push('direction');
    }

    // Check required dimensions
    for (const dim of requiredDimensions) {
      if (!lockedTypes.has(dim)) {
        missing.push(dim);
      }
    }

    // Check camera motion
    if (!session.cameraMotion) {
      missing.push('camera_motion');
    }

    if (missing.length > 0) {
      this.log.warn('Session incomplete, missing selections', {
        sessionId,
        missing,
      });
      throw new ConvergenceError('INCOMPLETE_SESSION', { missingDimensions: missing });
    }

    // 11.4.2: Build final prompt (if not already built during subject motion)
    const promptOptions = {
      intent: session.intent,
      direction: session.direction!,
      lockedDimensions: session.lockedDimensions,
      ...(session.subjectMotion ? { subjectMotion: session.subjectMotion } : {}),
    };
    const finalPrompt = session.finalPrompt || this.promptBuilder.buildPrompt(promptOptions);

    // 11.4.4: Mark session as completed
    await this.sessions.update(sessionId, {
      status: 'completed',
      finalPrompt,
      currentStep: 'complete',
    });

    // Get the preview image URL (last generated image)
    const lastImage = session.generatedImages[session.generatedImages.length - 1];
    const previewImageUrl = lastImage?.url ?? '';

    // 11.4.3: Calculate total credits consumed
    const totalCreditsConsumed = this.calculateTotalCredits(session);

    this.log.info('Session finalized successfully', {
      sessionId,
      totalCreditsConsumed,
      lockedDimensionCount: session.lockedDimensions.length,
    });

    return {
      sessionId,
      finalPrompt,
      lockedDimensions: session.lockedDimensions,
      previewImageUrl,
      cameraMotion: session.cameraMotion!,
      subjectMotion: session.subjectMotion ?? '',
      totalCreditsConsumed,
      generationCosts: GENERATION_COSTS,
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Get a session with ownership validation.
   *
   * Helper for all session operations that require ownership check.
   * Throws appropriate errors if session not found or user unauthorized.
   *
   * @param sessionId - Session UUID
   * @param userId - Firebase Auth UID
   * @returns ConvergenceSession if found and owned by user
   * @throws ConvergenceError('SESSION_NOT_FOUND') if session doesn't exist
   * @throws ConvergenceError('UNAUTHORIZED') if session belongs to different user
   */
  private async getSessionWithOwnershipCheck(
    sessionId: string,
    userId: string
  ): Promise<ConvergenceSession> {
    const session = await this.sessions.get(sessionId);

    if (!session) {
      this.log.warn('Session not found', { sessionId, userId });
      throw new ConvergenceError('SESSION_NOT_FOUND');
    }

    if (session.userId !== userId) {
      this.log.warn('Unauthorized session access attempt', {
        sessionId,
        sessionUserId: session.userId,
        requestUserId: userId,
      });
      throw new ConvergenceError('UNAUTHORIZED');
    }

    return session;
  }

  /**
   * Generate images and persist them to GCS.
   *
   * Requirement 1.7: Store generated images in permanent storage (GCS)
   * Requirement 2.3: Generate all images in parallel
   * Requirement 2.5: Retry up to 2 times before returning error
   *
   * @param prompts - Array of prompt info with prompt, dimension, and optionId
   * @param userId - Firebase Auth UID for storage path
   * @param aspectRatio - Optional aspect ratio (default: '16:9')
   * @returns Array of GeneratedImage with permanent GCS URLs
   */
  private async generateAndPersistImages(
    prompts: PromptInfo[],
    userId: string,
    aspectRatio: string = '16:9'
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();

    this.log.debug('Generating images', {
      count: prompts.length,
      userId,
      aspectRatio,
    });

    // Generate images with retry and aspect ratio (Requirement 2.3, 2.5)
    const generationResults = await Promise.all(
      prompts.map((p) =>
        withRetry(() =>
          this.imageGen.generatePreview(p.prompt, {
            aspectRatio,
            // Use flux-schnell for cost-efficient previews (Requirement 2.2)
            provider: 'replicate-flux-schnell',
          })
        )
      )
    );

    // Extract temporary URLs from generation results
    const tempUrls = generationResults.map((r) => r.imageUrl);

    // Upload to GCS for permanent storage (Requirement 1.7)
    const permanentUrls = await this.storage.uploadBatch(
      tempUrls,
      `convergence/${userId}`
    );

    const duration = Date.now() - startTime;

    this.log.info('Images generated and persisted', {
      count: prompts.length,
      duration,
      userId,
    });

    // Build GeneratedImage array with permanent URLs
    return permanentUrls.map((url, i) => ({
      id: uuidv4(),
      url,
      dimension: prompts[i]!.dimension as DimensionType | 'direction',
      optionId: prompts[i]!.optionId,
      prompt: prompts[i]!.prompt,
      generatedAt: new Date(),
    }));
  }

  /**
   * Calculate total credits consumed during a session.
   *
   * Sums up all credits consumed for:
   * - Direction images (initial)
   * - Dimension images (mood, framing, lighting)
   * - Depth estimation (if used)
   * - Wan preview (if used)
   * - Regenerations
   *
   * @param session - The convergence session
   * @returns Total credits consumed
   */
  private calculateTotalCredits(session: ConvergenceSession): number {
    let total = CONVERGENCE_COSTS.DIRECTION_IMAGES; // Initial direction images

    // Add dimension image costs (mood, framing, lighting)
    const dimensionSteps = ['mood', 'framing', 'lighting'];
    const lockedDimensionTypes = new Set(session.lockedDimensions.map((d) => d.type));

    for (const step of dimensionSteps) {
      if (lockedDimensionTypes.has(step as DimensionType)) {
        total += CONVERGENCE_COSTS.DIMENSION_IMAGES;
      }
    }

    // Add depth estimation if used
    if (session.depthMapUrl) {
      total += CONVERGENCE_COSTS.DEPTH_ESTIMATION;
    }

    // Add Wan preview if used (indicated by subjectMotion being set and finalPrompt existing)
    if (session.subjectMotion && session.finalPrompt) {
      total += CONVERGENCE_COSTS.WAN_PREVIEW;
    }

    // Add regeneration costs
    const regenCounts = session.regenerationCounts || {};
    for (const count of Object.values(regenCounts)) {
      total += (count as number) * CONVERGENCE_COSTS.REGENERATION;
    }

    return total;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ConvergenceService instance with all dependencies.
 *
 * @param deps - Service dependencies
 * @returns ConvergenceService instance
 */
export function createConvergenceService(
  deps: ConvergenceServiceDeps
): ConvergenceService {
  return new ConvergenceService(deps);
}

export default ConvergenceService;
