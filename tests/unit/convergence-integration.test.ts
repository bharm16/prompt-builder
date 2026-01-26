/**
 * Integration tests for Visual Convergence feature
 *
 * Tests the integration between internal components including:
 * - Full convergence flow end-to-end (intent → finalize)
 * - Session resume flow
 * - Credit deduction and refund on failure
 * - Tool switching with handoff to Studio
 *
 * Requirements tested:
 * - 1.1-1.11: Session management
 * - 2.1-2.5: Direction fork
 * - 3.1-3.6: Dimension selection flow
 * - 8.1-8.4: Session finalization
 * - 15.5-15.8: Credit visibility and reservation
 * - 17.1-17.7: Tool switching and handoff
 *
 * Task: 34 Integration tests
 *
 * @module convergence-integration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ConvergenceSession,
  GeneratedImage,
  LockedDimension,
  CreditReservation,
  DimensionType,
  Direction,
  CameraPath,
} from '@services/convergence/types';
import { ConvergenceError } from '@services/convergence/errors';
import { ConvergenceService, type ConvergenceServiceDeps } from '@services/convergence/ConvergenceService';
import { DIRECTION_OPTIONS, CAMERA_PATHS, CONVERGENCE_COSTS, GENERATION_COSTS } from '@services/convergence/constants';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock uuid to generate predictable IDs
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${++uuidCounter}`),
}));

// ============================================================================
// Test Helpers - Mock Factories
// ============================================================================

/**
 * Creates a mock session store with in-memory storage
 */
function createMockSessionStore() {
  const sessions: Map<string, ConvergenceSession> = new Map();

  return {
    create: vi.fn(async (session: ConvergenceSession) => {
      sessions.set(session.id, { ...session });
    }),
    get: vi.fn(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session ? { ...session } : null;
    }),
    update: vi.fn(async (sessionId: string, updates: Partial<ConvergenceSession>) => {
      const session = sessions.get(sessionId);
      if (session) {
        sessions.set(sessionId, { ...session, ...updates, updatedAt: new Date() });
      }
    }),
    delete: vi.fn(async (sessionId: string) => {
      sessions.delete(sessionId);
    }),
    getActiveByUserId: vi.fn(async (userId: string) => {
      for (const session of sessions.values()) {
        if (session.userId === userId && session.status === 'active') {
          return { ...session };
        }
      }
      return null;
    }),
    getByUserId: vi.fn(async () => []),
    cleanupExpired: vi.fn(async () => 0),
    abandonSession: vi.fn(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.status = 'abandoned';
        sessions.set(sessionId, session);
        return { ...session };
      }
      return null;
    }),
    _sessions: sessions,
    _clear: () => sessions.clear(),
  };
}

/**
 * Creates a mock credits service with balance tracking
 */
function createMockCreditsService(initialBalance: number = 100) {
  let balance = initialBalance;
  const reservations: Map<string, CreditReservation> = new Map();
  let reservationCounter = 0;

  return {
    getBalance: vi.fn(async () => balance),
    reserve: vi.fn(async (userId: string, amount: number) => {
      if (balance < amount) {
        throw new ConvergenceError('INSUFFICIENT_CREDITS', { required: amount, available: balance });
      }
      balance -= amount;
      const reservation: CreditReservation = {
        id: `reservation-${++reservationCounter}`,
        userId,
        amount,
        createdAt: new Date(),
        status: 'pending',
      };
      reservations.set(reservation.id, reservation);
      return reservation;
    }),
    commit: vi.fn(async (reservationId: string) => {
      const reservation = reservations.get(reservationId);
      if (reservation) {
        reservation.status = 'committed';
      }
    }),
    refund: vi.fn(async (reservationId: string) => {
      const reservation = reservations.get(reservationId);
      if (reservation && reservation.status === 'pending') {
        balance += reservation.amount;
        reservation.status = 'refunded';
      }
    }),
    debit: vi.fn(async (userId: string, amount: number) => {
      if (balance < amount) {
        throw new ConvergenceError('INSUFFICIENT_CREDITS', { required: amount, available: balance });
      }
      balance -= amount;
    }),
    _getBalance: () => balance,
    _setBalance: (newBalance: number) => { balance = newBalance; },
    _reservations: reservations,
    _reset: (newBalance: number = 100) => {
      balance = newBalance;
      reservations.clear();
      reservationCounter = 0;
    },
  };
}

/**
 * Creates a mock image generation service
 */
function createMockImageGenerationService() {
  let imageCounter = 0;
  return {
    generatePreview: vi.fn(async (prompt: string) => ({
      imageUrl: `https://replicate.com/temp/image-${++imageCounter}.png`,
      prompt,
    })),
    _reset: () => { imageCounter = 0; },
  };
}

/**
 * Creates a mock storage service
 */
function createMockStorageService() {
  let uploadCounter = 0;
  return {
    upload: vi.fn(async (tempUrl: string) =>
      `https://storage.googleapis.com/bucket/permanent-${++uploadCounter}.png`
    ),
    uploadBatch: vi.fn(async (tempUrls: string[]) =>
      tempUrls.map(() => `https://storage.googleapis.com/bucket/permanent-${++uploadCounter}.png`)
    ),
    uploadFromUrl: vi.fn(async (sourceUrl: string) =>
      `https://storage.googleapis.com/bucket/permanent-${++uploadCounter}.png`
    ),
    uploadBuffer: vi.fn(async () =>
      `https://storage.googleapis.com/bucket/permanent-${++uploadCounter}.png`
    ),
    delete: vi.fn(async () => {}),
    _reset: () => { uploadCounter = 0; },
  };
}

/**
 * Creates a mock depth estimation service
 */
function createMockDepthEstimationService(shouldFail: boolean = false) {
  let depthCounter = 0;
  return {
    estimateDepth: vi.fn(async (imageUrl: string) => {
      if (shouldFail) {
        throw new Error('Depth estimation failed');
      }
      return `https://storage.googleapis.com/bucket/depth-${++depthCounter}.png`;
    }),
    isAvailable: vi.fn(() => !shouldFail),
    _setFail: (fail: boolean) => { shouldFail = fail; },
    _reset: () => { depthCounter = 0; },
  };
}

/**
 * Creates a mock prompt builder service
 */
function createMockPromptBuilderService() {
  return {
    buildPrompt: vi.fn((options) => {
      const parts = [options.intent];
      if (options.direction) parts.push(`${options.direction} style`);
      options.lockedDimensions?.forEach((d: LockedDimension) => {
        parts.push(d.label.toLowerCase());
      });
      if (options.subjectMotion) parts.push(options.subjectMotion);
      return parts.join(', ');
    }),
    buildQuickGeneratePrompt: vi.fn((intent) => `${intent}, quick generate`),
    buildFinalFramePrompt: vi.fn((options) => `${options.intent}, final frame`),
    buildSubjectMotionPrompt: vi.fn((options) => `${options.intent}, ${options.subjectMotion}`),
    buildDimensionPreviewPrompt: vi.fn((intent, direction, lockedDimensions, previewDimension) => {
      const parts = [intent, `${direction} style`];
      lockedDimensions?.forEach((d: LockedDimension) => parts.push(d.label.toLowerCase()));
      parts.push(`${previewDimension.optionId} preview`);
      return parts.join(', ');
    }),
    buildDirectionPrompts: vi.fn((intent) => [
      { direction: 'cinematic' as Direction, prompt: `${intent}, cinematic style` },
      { direction: 'social' as Direction, prompt: `${intent}, social style` },
      { direction: 'artistic' as Direction, prompt: `${intent}, artistic style` },
      { direction: 'documentary' as Direction, prompt: `${intent}, documentary style` },
    ]),
    buildRegeneratedPrompt: vi.fn((options) => `${options.intent}, regenerated`),
    buildRegeneratedDimensionPreviewPrompt: vi.fn((intent, direction, lockedDimensions, previewDimension) =>
      `${intent}, ${direction}, ${previewDimension.optionId} regenerated`
    ),
    buildRegeneratedDirectionPrompts: vi.fn((intent) => [
      { direction: 'cinematic' as Direction, prompt: `${intent}, cinematic regenerated` },
      { direction: 'social' as Direction, prompt: `${intent}, social regenerated` },
      { direction: 'artistic' as Direction, prompt: `${intent}, artistic regenerated` },
      { direction: 'documentary' as Direction, prompt: `${intent}, documentary regenerated` },
    ]),
  };
}

/**
 * Creates a mock video preview service
 */
function createMockVideoPreviewService(shouldFail: boolean = false) {
  let videoCounter = 0;
  return {
    generatePreview: vi.fn(async (prompt: string) => {
      if (shouldFail) {
        throw new Error('Video generation failed');
      }
      return `https://storage.googleapis.com/bucket/video-${++videoCounter}.mp4`;
    }),
    isAvailable: vi.fn(() => !shouldFail),
    _setFail: (fail: boolean) => { shouldFail = fail; },
    _reset: () => { videoCounter = 0; },
  };
}

/**
 * Creates all mock dependencies for ConvergenceService
 */
function createMockDeps(options: {
  initialBalance?: number;
  depthFails?: boolean;
  videoFails?: boolean;
} = {}) {
  const { initialBalance = 100, depthFails = false, videoFails = false } = options;

  return {
    imageGenerationService: createMockImageGenerationService() as unknown as ConvergenceServiceDeps['imageGenerationService'],
    depthEstimationService: createMockDepthEstimationService(depthFails) as unknown as ConvergenceServiceDeps['depthEstimationService'],
    sessionStore: createMockSessionStore() as unknown as ConvergenceServiceDeps['sessionStore'] & ReturnType<typeof createMockSessionStore>,
    promptBuilder: createMockPromptBuilderService() as unknown as ConvergenceServiceDeps['promptBuilder'],
    creditsService: createMockCreditsService(initialBalance) as unknown as ConvergenceServiceDeps['creditsService'] & ReturnType<typeof createMockCreditsService>,
    storageService: createMockStorageService() as unknown as ConvergenceServiceDeps['storageService'],
    videoPreviewService: createMockVideoPreviewService(videoFails) as unknown as ConvergenceServiceDeps['videoPreviewService'],
  };
}

// ============================================================================
// Test Helpers - Data Factories
// ============================================================================

/**
 * Creates a test generated image
 */
function createTestImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: `test-image-${Math.random().toString(36).substring(7)}`,
    url: 'https://storage.googleapis.com/bucket/test-image.png',
    dimension: 'direction',
    optionId: 'cinematic',
    prompt: 'A beautiful sunset, cinematic composition',
    generatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a test locked dimension
 */
function createTestLockedDimension(
  type: DimensionType,
  optionId: string,
  label: string
): LockedDimension {
  return {
    type,
    optionId,
    label,
    promptFragments: [`${label.toLowerCase()} fragment 1`, `${label.toLowerCase()} fragment 2`],
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Convergence Integration Tests', () => {
  let service: ConvergenceService;
  let mockDeps: ReturnType<typeof createMockDeps>;
  const testUserId = 'test-user-123';
  const testIntent = 'A beautiful sunset over the ocean';

  beforeEach(() => {
    uuidCounter = 0;
    mockDeps = createMockDeps();
    service = new ConvergenceService(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Task 34.1: Test full convergence flow end-to-end (intent → finalize)
  // ==========================================================================
  describe('34.1 Full Convergence Flow End-to-End', () => {
    /**
     * Tests the complete flow from intent submission to session finalization.
     * This is the happy path where all operations succeed.
     *
     * Requirements tested:
     * - 1.1: Session created with unique identifier
     * - 2.1-2.5: Direction fork with image generation
     * - 3.1-3.6: Dimension selection flow
     * - 8.1-8.4: Session finalization
     */
    it('should complete full flow from intent to finalization', async () => {
      // Step 1: Start session with intent
      const startResult = await service.startSession({ intent: testIntent }, testUserId);

      expect(startResult.sessionId).toBeDefined();
      expect(startResult.images).toHaveLength(0);
      expect(startResult.currentDimension).toBe('starting_point');
      expect(startResult.options).toBeUndefined();

      const sessionId = startResult.sessionId;

      // Step 2: Choose converge starting point to generate direction options
      const startingPointResult = await service.setStartingPoint(
        { sessionId, mode: 'converge' },
        testUserId
      );

      expect(startingPointResult.nextStep).toBe('direction');
      expect(startingPointResult.images).toHaveLength(4);
      expect(startingPointResult.options).toEqual(DIRECTION_OPTIONS);

      // Step 3: Select direction (cinematic)
      const directionResult = await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );

      expect(directionResult.direction).toBe('cinematic');
      expect(directionResult.currentDimension).toBe('mood');
      expect(directionResult.images).toHaveLength(4);
      expect(directionResult.lockedDimensions).toHaveLength(0);

      // Step 4: Select mood (dramatic)
      const moodResult = await service.selectOption(
        { sessionId, dimension: 'mood', optionId: 'dramatic' },
        testUserId
      );

      expect(moodResult.currentDimension).toBe('framing');
      expect(moodResult.images).toHaveLength(4);
      expect(moodResult.lockedDimensions).toHaveLength(1);
      expect(moodResult.lockedDimensions[0]?.type).toBe('mood');

      // Step 5: Select framing (wide)
      const framingResult = await service.selectOption(
        { sessionId, dimension: 'framing', optionId: 'wide' },
        testUserId
      );

      expect(framingResult.currentDimension).toBe('lighting');
      expect(framingResult.images).toHaveLength(4);
      expect(framingResult.lockedDimensions).toHaveLength(2);

      // Step 6: Select lighting (golden_hour) - transitions to final_frame
      const lightingResult = await service.selectOption(
        { sessionId, dimension: 'lighting', optionId: 'golden_hour' },
        testUserId
      );

      expect(lightingResult.currentDimension).toBe('final_frame');
      expect(lightingResult.images).toHaveLength(0); // No images for final frame
      expect(lightingResult.lockedDimensions).toHaveLength(3);
      expect(lightingResult.creditsConsumed).toBe(0); // Transition doesn't consume credits

      // Step 7: Generate final frame
      const finalFrameResult = await service.generateFinalFrame({ sessionId }, testUserId);

      expect(finalFrameResult.finalFrameUrl).toBeDefined();

      // Step 8: Generate camera motion (depth estimation)
      const cameraMotionResult = await service.generateCameraMotion({ sessionId }, testUserId);

      expect(cameraMotionResult.depthMapUrl).toBeDefined();
      expect(cameraMotionResult.cameraPaths).toEqual(CAMERA_PATHS);
      expect(cameraMotionResult.fallbackMode).toBe(false);

      // Step 9: Select camera motion (push_in)
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);

      // Step 10: Generate subject motion preview (optional)
      const subjectMotionResult = await service.generateSubjectMotion(
        { sessionId, subjectMotion: 'waves gently rolling' },
        testUserId
      );

      expect(subjectMotionResult.videoUrl).toBeDefined();
      expect(subjectMotionResult.prompt).toContain(testIntent);
      expect(subjectMotionResult.inputMode).toBe('i2v');
      expect(subjectMotionResult.startImageUrl).toBe(finalFrameResult.finalFrameUrl);

      // Step 11: Finalize session
      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      expect(finalizeResult.sessionId).toBe(sessionId);
      expect(finalizeResult.finalPrompt).toBeDefined();
      expect(finalizeResult.lockedDimensions).toHaveLength(3);
      expect(finalizeResult.cameraMotion).toBe('push_in');
      expect(finalizeResult.subjectMotion).toBe('waves gently rolling');
      expect(finalizeResult.generationCosts).toEqual(GENERATION_COSTS);
      expect(finalizeResult.totalCreditsConsumed).toBeGreaterThan(0);

      // Verify session is marked as completed
      const finalSession = await service.getSession(sessionId);
      expect(finalSession?.status).toBe('completed');
      expect(finalSession?.currentStep).toBe('complete');
    });

    /**
     * Tests the flow without subject motion (skipping optional step).
     *
     * Requirement 7.1: Subject motion step is OPTIONAL
     */
    it('should complete flow without subject motion (skip optional step)', async () => {
      // Start session
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Select direction
      await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );

      // Select mood
      await service.selectOption(
        { sessionId, dimension: 'mood', optionId: 'dramatic' },
        testUserId
      );

      // Select framing
      await service.selectOption(
        { sessionId, dimension: 'framing', optionId: 'wide' },
        testUserId
      );

      // Select lighting
      await service.selectOption(
        { sessionId, dimension: 'lighting', optionId: 'golden_hour' },
        testUserId
      );

      await service.generateFinalFrame({ sessionId }, testUserId);

      // Generate camera motion
      await service.generateCameraMotion({ sessionId }, testUserId);

      // Select camera motion
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'static' }, testUserId);

      // Skip subject motion and finalize directly
      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      expect(finalizeResult.sessionId).toBe(sessionId);
      expect(finalizeResult.subjectMotion).toBe('');
      expect(finalizeResult.cameraMotion).toBe('static');
    });

    /**
     * Tests that finalization fails when required dimensions are missing.
     *
     * Requirement 8.3-8.4: Validate required selections before finalization
     */
    it('should fail finalization when required dimensions are missing', async () => {
      // Start session
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Only select direction, skip other dimensions
      await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );

      // Try to finalize without completing all dimensions
      await expect(service.finalizeSession(sessionId, testUserId)).rejects.toThrow(ConvergenceError);

      try {
        await service.finalizeSession(sessionId, testUserId);
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INCOMPLETE_SESSION');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('framing');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('lighting');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('camera_motion');
      }
    });

    /**
     * Tests dimension order is preserved throughout the flow.
     *
     * Requirement 3.5: Process dimensions in order: mood → framing → lighting → final_frame
     */
    it('should preserve dimension order throughout flow', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Select direction
      const dirResult = await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );
      expect(dirResult.currentDimension).toBe('mood');

      // Select mood
      const moodResult = await service.selectOption(
        { sessionId, dimension: 'mood', optionId: 'dramatic' },
        testUserId
      );
      expect(moodResult.currentDimension).toBe('framing');

      // Select framing
      const framingResult = await service.selectOption(
        { sessionId, dimension: 'framing', optionId: 'wide' },
        testUserId
      );
      expect(framingResult.currentDimension).toBe('lighting');

      // Select lighting - should transition to final_frame
      const lightingResult = await service.selectOption(
        { sessionId, dimension: 'lighting', optionId: 'golden_hour' },
        testUserId
      );
      expect(lightingResult.currentDimension).toBe('final_frame');

      // Verify locked dimensions are in correct order
      const session = await service.getSession(sessionId);
      const lockedTypes = session?.lockedDimensions.map(d => d.type);
      expect(lockedTypes).toEqual(['mood', 'framing', 'lighting']);
    });
  });


  // ==========================================================================
  // Task 34.2: Test session resume flow
  // ==========================================================================
  describe('34.2 Session Resume Flow', () => {
    /**
     * Tests that an active session can be retrieved for resume.
     *
     * Requirement 1.6: Resume incomplete sessions from previous visits
     */
    it('should retrieve active session for resume', async () => {
      // Start a session
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Make some progress
      await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );

      await service.selectOption(
        { sessionId, dimension: 'mood', optionId: 'dramatic' },
        testUserId
      );

      // Retrieve active session (simulating page reload)
      const activeSession = await service.getActiveSession(testUserId);

      expect(activeSession).not.toBeNull();
      expect(activeSession?.id).toBe(sessionId);
      expect(activeSession?.intent).toBe(testIntent);
      expect(activeSession?.direction).toBe('cinematic');
      expect(activeSession?.currentStep).toBe('framing');
      expect(activeSession?.lockedDimensions).toHaveLength(1);
      expect(activeSession?.status).toBe('active');
    });

    /**
     * Tests that session state is preserved correctly for resume.
     *
     * Requirement 9.8: Preserve previously generated images for each dimension
     */
    it('should preserve session state including imageHistory for resume', async () => {
      // Start a session
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Progress through multiple steps
      await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'artistic' },
        testUserId
      );

      await service.selectOption(
        { sessionId, dimension: 'mood', optionId: 'mysterious' },
        testUserId
      );

      // Retrieve session
      const session = await service.getSession(sessionId);

      // Verify imageHistory is preserved
      expect(session?.imageHistory).toBeDefined();
      expect(session?.imageHistory.direction).toBeDefined();
      expect(session?.imageHistory.mood).toBeDefined();
      expect(session?.imageHistory.framing).toBeDefined();
    });

    /**
     * Tests that only one active session per user is allowed.
     *
     * Requirement 1.10-1.11: Only ONE active session per user at a time
     */
    it('should prevent starting new session when active session exists', async () => {
      // Start first session
      await service.startSession({ intent: testIntent }, testUserId);

      // Try to start another session
      await expect(
        service.startSession({ intent: 'Another intent' }, testUserId)
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.startSession({ intent: 'Another intent' }, testUserId);
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('ACTIVE_SESSION_EXISTS');
      }
    });

    /**
     * Tests that completed sessions don't block new sessions.
     */
    it('should allow new session after previous session is completed', async () => {
      // Start and complete first session
      const firstResult = await service.startSession({ intent: testIntent }, testUserId);
      const firstSessionId = firstResult.sessionId;

      // Complete the flow
      await service.setStartingPoint({ sessionId: firstSessionId, mode: 'converge' }, testUserId);
      await service.selectOption(
        { sessionId: firstSessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );
      await service.selectOption(
        { sessionId: firstSessionId, dimension: 'mood', optionId: 'dramatic' },
        testUserId
      );
      await service.selectOption(
        { sessionId: firstSessionId, dimension: 'framing', optionId: 'wide' },
        testUserId
      );
      await service.selectOption(
        { sessionId: firstSessionId, dimension: 'lighting', optionId: 'golden_hour' },
        testUserId
      );
      await service.generateFinalFrame({ sessionId: firstSessionId }, testUserId);
      await service.generateCameraMotion({ sessionId: firstSessionId }, testUserId);
      await service.selectCameraMotion({ sessionId: firstSessionId, cameraMotionId: 'push_in' }, testUserId);
      await service.finalizeSession(firstSessionId, testUserId);

      // Verify first session is completed
      const completedSession = await service.getSession(firstSessionId);
      expect(completedSession?.status).toBe('completed');

      // Should be able to start a new session
      const secondResult = await service.startSession({ intent: 'New creative vision' }, testUserId);
      expect(secondResult.sessionId).toBeDefined();
      expect(secondResult.sessionId).not.toBe(firstSessionId);
    });

    /**
     * Tests that getActiveSession returns null when no active session exists.
     */
    it('should return null when no active session exists', async () => {
      const activeSession = await service.getActiveSession('user-without-session');
      expect(activeSession).toBeNull();
    });

    /**
     * Tests session retrieval by ID.
     *
     * Requirement 1.3: Allow retrieval of session by identifier
     */
    it('should retrieve session by ID', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      const session = await service.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(sessionId);
      expect(session?.userId).toBe(testUserId);
      expect(session?.intent).toBe(testIntent);
    });

    /**
     * Tests that non-existent session returns null.
     */
    it('should return null for non-existent session ID', async () => {
      const session = await service.getSession('non-existent-session-id');
      expect(session).toBeNull();
    });
  });

  // ==========================================================================
  // Task 34.3: Test credit deduction and refund on failure
  // ==========================================================================
  describe('34.3 Credit Deduction and Refund on Failure', () => {
    /**
     * Tests that credits are deducted for successful operations.
     *
     * Requirement 15.6: Reserve credits at request time
     */
    it('should deduct credits for successful image generation', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Start session and choose converge (costs DIRECTION_IMAGES credits)
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      await service.setStartingPoint({ sessionId: startResult.sessionId, mode: 'converge' }, testUserId);

      // Verify credits were reserved and committed
      expect(mockDeps.creditsService.reserve).toHaveBeenCalledWith(
        testUserId,
        CONVERGENCE_COSTS.DIRECTION_IMAGES
      );
      expect(mockDeps.creditsService.commit).toHaveBeenCalled();
    });

    /**
     * Tests that credits are refunded when operation fails.
     *
     * Requirement 15.6: Refund automatically on failure
     */
    it('should refund credits when image generation fails', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Make image generation fail for all attempts (withRetry retries up to 2 times = 3 total attempts per image)
      // Since we generate 4 images in parallel, we need to fail all of them consistently
      const mockGeneratePreview = mockDeps.imageGenerationService.generatePreview as ReturnType<typeof vi.fn>;
      mockGeneratePreview.mockRejectedValue(new Error('Image generation failed'));

      const startResult = await service.startSession({ intent: testIntent }, testUserId);

      // Try to generate direction images
      await expect(
        service.setStartingPoint({ sessionId: startResult.sessionId, mode: 'converge' }, testUserId)
      ).rejects.toThrow('Image generation failed');

      // Verify credits were refunded
      expect(mockDeps.creditsService.refund).toHaveBeenCalled();
    });

    /**
     * Tests that insufficient credits blocks operation.
     *
     * Requirement 15.5: Block generation and prompt to purchase if insufficient credits
     */
    it('should block operation when insufficient credits', async () => {
      const lowBalance = 2; // Less than DIRECTION_IMAGES cost (4)
      mockDeps = createMockDeps({ initialBalance: lowBalance });
      service = new ConvergenceService(mockDeps);

      const startResult = await service.startSession({ intent: testIntent }, testUserId);

      await expect(
        service.setStartingPoint({ sessionId: startResult.sessionId, mode: 'converge' }, testUserId)
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.setStartingPoint({ sessionId: startResult.sessionId, mode: 'converge' }, testUserId);
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INSUFFICIENT_CREDITS');
        expect((error as ConvergenceError).details?.required).toBe(CONVERGENCE_COSTS.DIRECTION_IMAGES);
        expect((error as ConvergenceError).details?.available).toBe(lowBalance);
      }
    });

    /**
     * Tests credit deduction for dimension selection.
     */
    it('should deduct credits for each dimension selection', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Start session
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Clear mock calls from starting point generation
      vi.clearAllMocks();

      // Select direction (generates mood images)
      await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );

      // Verify credits were reserved for dimension images
      expect(mockDeps.creditsService.reserve).toHaveBeenCalledWith(
        testUserId,
        CONVERGENCE_COSTS.DIMENSION_IMAGES
      );
      expect(mockDeps.creditsService.commit).toHaveBeenCalled();
    });

    /**
     * Tests credit deduction for regeneration.
     *
     * Requirement 14.3: Regeneration costs credits
     */
    it('should deduct credits for regeneration', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Start session
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Clear mock calls
      vi.clearAllMocks();

      // Regenerate direction options
      const regenResult = await service.regenerate(
        { sessionId, dimension: 'direction' },
        testUserId
      );

      expect(regenResult.creditsConsumed).toBe(CONVERGENCE_COSTS.REGENERATION);
      expect(mockDeps.creditsService.reserve).toHaveBeenCalledWith(
        testUserId,
        CONVERGENCE_COSTS.REGENERATION
      );
    });

    /**
     * Tests credit deduction for depth estimation.
     */
    it('should deduct credits for depth estimation', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Complete flow up to camera motion
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);

      // Clear mock calls
      vi.clearAllMocks();

      // Generate camera motion (depth estimation)
      const cameraResult = await service.generateCameraMotion({ sessionId }, testUserId);

      expect(cameraResult.creditsConsumed).toBe(CONVERGENCE_COSTS.DEPTH_ESTIMATION);
      expect(mockDeps.creditsService.reserve).toHaveBeenCalledWith(
        testUserId,
        CONVERGENCE_COSTS.DEPTH_ESTIMATION
      );
    });

    /**
     * Tests credit refund when depth estimation fails.
     *
     * Requirement 5.5: Fallback mode when depth estimation fails
     */
    it('should refund credits when depth estimation fails and use fallback mode', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance, depthFails: true });
      service = new ConvergenceService(mockDeps);

      // Complete flow up to camera motion
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);

      // Generate camera motion (depth estimation will fail)
      const cameraResult = await service.generateCameraMotion({ sessionId }, testUserId);

      // Should return fallback mode
      expect(cameraResult.fallbackMode).toBe(true);
      expect(cameraResult.depthMapUrl).toBeNull();
      expect(cameraResult.creditsConsumed).toBe(0); // No credits consumed on failure
      expect(cameraResult.cameraPaths).toEqual(CAMERA_PATHS); // Still returns camera paths
    });

    /**
     * Tests credit deduction for video preview.
     */
    it('should deduct credits for video preview generation', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Complete flow up to subject motion
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);

      // Clear mock calls
      vi.clearAllMocks();

      // Generate subject motion preview
      const subjectResult = await service.generateSubjectMotion(
        { sessionId, subjectMotion: 'waves rolling' },
        testUserId
      );

      expect(subjectResult.creditsConsumed).toBe(CONVERGENCE_COSTS.WAN_PREVIEW);
      expect(mockDeps.creditsService.reserve).toHaveBeenCalledWith(
        testUserId,
        CONVERGENCE_COSTS.WAN_PREVIEW
      );
    });

    /**
     * Tests total credits calculation in finalization.
     */
    it('should calculate total credits consumed correctly in finalization', async () => {
      const initialBalance = 100;
      mockDeps = createMockDeps({ initialBalance });
      service = new ConvergenceService(mockDeps);

      // Complete full flow
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);
      await service.generateSubjectMotion({ sessionId, subjectMotion: 'waves rolling' }, testUserId);

      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      // Expected total:
      // - Direction images: 4
      // - Mood images: 4
      // - Framing images: 4
      // - Lighting images: 4
      // - Final frame: 2
      // - Depth estimation: 1
      // - Wan preview: 5
      // Total: 24
      const expectedTotal =
        CONVERGENCE_COSTS.DIRECTION_IMAGES +
        CONVERGENCE_COSTS.DIMENSION_IMAGES * 3 + // mood, framing, lighting
        CONVERGENCE_COSTS.FINAL_FRAME_HQ +
        CONVERGENCE_COSTS.DEPTH_ESTIMATION +
        CONVERGENCE_COSTS.WAN_PREVIEW;

      expect(finalizeResult.totalCreditsConsumed).toBe(expectedTotal);
    });
  });


  // ==========================================================================
  // Task 34.4: Test tool switching with handoff to Studio
  // ==========================================================================
  describe('34.4 Tool Switching with Handoff to Studio', () => {
    /**
     * Tests that finalization returns all data needed for Studio handoff.
     *
     * Requirements:
     * - 8.1: Return complete prompt, locked dimensions, preview image URL, camera motion, and subject motion
     * - 17.2-17.3: Pass converged prompt and metadata to Studio
     */
    it('should return complete handoff data on finalization', async () => {
      // Complete full flow
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);
      await service.generateSubjectMotion({ sessionId, subjectMotion: 'waves rolling' }, testUserId);

      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      // Verify all handoff data is present
      expect(finalizeResult.finalPrompt).toBeDefined();
      expect(finalizeResult.finalPrompt.length).toBeGreaterThan(0);

      expect(finalizeResult.lockedDimensions).toHaveLength(3);
      expect(finalizeResult.lockedDimensions.map(d => d.type)).toEqual(['mood', 'framing', 'lighting']);

      expect(finalizeResult.previewImageUrl).toBeDefined();
      expect(finalizeResult.previewImageUrl).toContain('storage.googleapis.com');

      expect(finalizeResult.cameraMotion).toBe('push_in');
      expect(finalizeResult.subjectMotion).toBe('waves rolling');

      // Verify generation costs are included for model selection
      expect(finalizeResult.generationCosts).toEqual(GENERATION_COSTS);
    });

    /**
     * Tests that locked dimensions contain all necessary metadata for Studio.
     *
     * Requirement 17.3: Preserve locked dimension metadata for reference
     */
    it('should include complete locked dimension metadata', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);

      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      // Each locked dimension should have complete metadata
      for (const dimension of finalizeResult.lockedDimensions) {
        expect(dimension.type).toBeDefined();
        expect(dimension.optionId).toBeDefined();
        expect(dimension.label).toBeDefined();
        expect(dimension.promptFragments).toBeDefined();
        expect(Array.isArray(dimension.promptFragments)).toBe(true);
      }
    });

    /**
     * Tests that final prompt includes all selected options.
     */
    it('should build final prompt with all selections', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);
      await service.generateSubjectMotion({ sessionId, subjectMotion: 'waves rolling' }, testUserId);

      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      // Verify prompt builder was called with correct options
      expect(mockDeps.promptBuilder.buildPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: testIntent,
          direction: 'cinematic',
          subjectMotion: 'waves rolling',
        })
      );

      // Verify final prompt contains the intent
      expect(finalizeResult.finalPrompt).toContain(testIntent);
    });

    /**
     * Tests that session can be retrieved after finalization for reference.
     *
     * Requirement 17.5: Preserve session state for return
     */
    it('should preserve completed session for reference', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);

      await service.finalizeSession(sessionId, testUserId);

      // Session should still be retrievable
      const session = await service.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.status).toBe('completed');
      expect(session?.finalPrompt).toBeDefined();
      expect(session?.direction).toBe('cinematic');
      expect(session?.cameraMotion).toBe('push_in');
    });

    /**
     * Tests that generation costs are returned for model selection UI.
     *
     * Requirement 15.4: Display final generation cost for each available model
     */
    it('should return generation costs for all models', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);

      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      // Verify all model costs are included
      expect(finalizeResult.generationCosts['sora-2']).toBe(80);
      expect(finalizeResult.generationCosts['veo-3']).toBe(30);
      expect(finalizeResult.generationCosts['kling-v2.1']).toBe(35);
      expect(finalizeResult.generationCosts['luma-ray-3']).toBe(40);
      expect(finalizeResult.generationCosts['wan-2.2']).toBe(15);
      expect(finalizeResult.generationCosts['runway-gen4']).toBe(50);
    });

    /**
     * Tests that preview image URL is valid GCS URL.
     *
     * Requirement 1.7: Store generated images in permanent storage (GCS)
     */
    it('should return valid GCS URL for preview image', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);
      await service.generateCameraMotion({ sessionId }, testUserId);
      await service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, testUserId);

      const finalizeResult = await service.finalizeSession(sessionId, testUserId);

      // Preview image should be a GCS URL (permanent storage)
      expect(finalizeResult.previewImageUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//);
    });
  });

  // ==========================================================================
  // Additional Integration Tests
  // ==========================================================================
  describe('Additional Integration Scenarios', () => {
    /**
     * Tests regeneration limit enforcement across the flow.
     *
     * Requirement 14.4: Limit regeneration to 3 times per dimension per session
     */
    it('should enforce regeneration limit per dimension', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      // Regenerate direction 3 times (max allowed)
      await service.regenerate({ sessionId, dimension: 'direction' }, testUserId);
      await service.regenerate({ sessionId, dimension: 'direction' }, testUserId);
      const thirdRegen = await service.regenerate({ sessionId, dimension: 'direction' }, testUserId);

      expect(thirdRegen.remainingRegenerations).toBe(0);

      // Fourth regeneration should fail
      await expect(
        service.regenerate({ sessionId, dimension: 'direction' }, testUserId)
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.regenerate({ sessionId, dimension: 'direction' }, testUserId);
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('REGENERATION_LIMIT_EXCEEDED');
      }
    });

    /**
     * Tests ownership validation across all operations.
     *
     * Requirement 1.8: Require authentication
     */
    it('should enforce ownership validation for all operations', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      const attackerUserId = 'attacker-user';

      // All operations should fail for wrong user
      await expect(
        service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, attackerUserId)
      ).rejects.toThrow(ConvergenceError);

      await expect(
        service.regenerate({ sessionId, dimension: 'direction' }, attackerUserId)
      ).rejects.toThrow(ConvergenceError);

      await expect(
        service.generateCameraMotion({ sessionId }, attackerUserId)
      ).rejects.toThrow(ConvergenceError);

      await expect(
        service.selectCameraMotion({ sessionId, cameraMotionId: 'push_in' }, attackerUserId)
      ).rejects.toThrow(ConvergenceError);

      await expect(
        service.generateSubjectMotion({ sessionId, subjectMotion: 'test' }, attackerUserId)
      ).rejects.toThrow(ConvergenceError);

      await expect(
        service.finalizeSession(sessionId, attackerUserId)
      ).rejects.toThrow(ConvergenceError);
    });

    /**
     * Tests that images are stored in GCS throughout the flow.
     *
     * Requirement 1.7: Store generated images in permanent storage (GCS)
     */
    it('should store all images in GCS', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      const startingPointResult = await service.setStartingPoint(
        { sessionId, mode: 'converge' },
        testUserId
      );

      // All direction images should have GCS URLs
      for (const image of startingPointResult.images ?? []) {
        expect(image.url).toMatch(/^https:\/\/storage\.googleapis\.com\//);
      }

      // Continue flow and verify GCS storage
      const directionResult = await service.selectOption(
        { sessionId, dimension: 'direction', optionId: 'cinematic' },
        testUserId
      );

      for (const image of directionResult.images) {
        expect(image.url).toMatch(/^https:\/\/storage\.googleapis\.com\//);
      }

      // Verify storage service was called
      expect(mockDeps.storageService.uploadBatch).toHaveBeenCalled();
    });

    /**
     * Tests camera motion selection with valid and invalid IDs.
     */
    it('should validate camera motion ID', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);
      const sessionId = startResult.sessionId;

      await service.setStartingPoint({ sessionId, mode: 'converge' }, testUserId);

      await service.selectOption({ sessionId, dimension: 'direction', optionId: 'cinematic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'mood', optionId: 'dramatic' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'framing', optionId: 'wide' }, testUserId);
      await service.selectOption({ sessionId, dimension: 'lighting', optionId: 'golden_hour' }, testUserId);
      await service.generateFinalFrame({ sessionId }, testUserId);

      // Valid camera motion IDs should work
      for (const path of CAMERA_PATHS) {
        // Reset session camera motion for each test
        await (mockDeps.sessionStore as ReturnType<typeof createMockSessionStore>).update(sessionId, {
          cameraMotion: null,
          currentStep: 'camera_motion',
        });

        await expect(
          service.selectCameraMotion({ sessionId, cameraMotionId: path.id }, testUserId)
        ).resolves.not.toThrow();
      }

      // Invalid camera motion ID should fail
      await expect(
        service.selectCameraMotion({ sessionId, cameraMotionId: 'invalid_motion' }, testUserId)
      ).rejects.toThrow('Invalid camera motion ID');
    });

    /**
     * Tests that session remains active when starting point selection fails.
     */
    it('should keep session active when starting point fails', async () => {
      const startResult = await service.startSession({ intent: testIntent }, testUserId);

      // Make image generation fail
      (mockDeps.imageGenerationService as ReturnType<typeof createMockImageGenerationService>).generatePreview
        .mockRejectedValue(new Error('Generation failed'));

      await expect(
        service.setStartingPoint({ sessionId: startResult.sessionId, mode: 'converge' }, testUserId)
      ).rejects.toThrow('Generation failed');

      // Session should remain active and in starting_point
      const session = await service.getSession(startResult.sessionId);
      expect(session?.status).toBe('active');
      expect(session?.currentStep).toBe('starting_point');
    });
  });
});
