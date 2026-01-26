/**
 * Unit tests for ConvergenceService
 *
 * Tests the main orchestrator service for Visual Convergence feature including
 * session lifecycle, credit reservation, ownership validation, and error handling.
 *
 * Requirements tested:
 * - 1.1: Session created with unique identifier and persisted to Firestore
 * - 1.6: Resume incomplete sessions from previous visits
 * - 1.7: Store generated images in permanent storage (GCS)
 * - 1.10-1.11: Only ONE active session per user at a time
 * - 8.3-8.4: Finalization validation
 * - 14.4: Regeneration limit (max 3 per dimension)
 * - 15.6: Reserve credits at request time and refund on failure
 *
 * @module convergence-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ConvergenceSession,
  GeneratedImage,
  LockedDimension,
  CreditReservation,
} from '@services/convergence/types';
import { ConvergenceError } from '@services/convergence/errors';
import { ConvergenceService, type ConvergenceServiceDeps } from '@services/convergence/ConvergenceService';

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

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
}));

/**
 * Creates a mock session store
 */
function createMockSessionStore() {
  const sessions: Map<string, ConvergenceSession> = new Map();

  return {
    create: vi.fn(async (session: ConvergenceSession) => {
      sessions.set(session.id, session);
    }),
    get: vi.fn(async (sessionId: string) => sessions.get(sessionId) || null),
    update: vi.fn(async (sessionId: string, updates: Partial<ConvergenceSession>) => {
      const session = sessions.get(sessionId);
      if (session) {
        sessions.set(sessionId, { ...session, ...updates });
      }
    }),
    delete: vi.fn(async (sessionId: string) => {
      sessions.delete(sessionId);
    }),
    getActiveByUserId: vi.fn(async (userId: string) => {
      for (const session of sessions.values()) {
        if (session.userId === userId && session.status === 'active') {
          return session;
        }
      }
      return null;
    }),
    getByUserId: vi.fn(async () => []),
    cleanupExpired: vi.fn(async () => 0),
    _sessions: sessions,
  };
}

/**
 * Creates a mock credits service
 */
function createMockCreditsService() {
  const balances: Map<string, number> = new Map();
  const reservations: Map<string, CreditReservation> = new Map();

  return {
    getBalance: vi.fn(async (userId: string) => balances.get(userId) ?? 100),
    reserve: vi.fn(async (userId: string, amount: number) => {
      const balance = balances.get(userId) ?? 100;
      if (balance < amount) {
        throw new ConvergenceError('INSUFFICIENT_CREDITS', { required: amount, available: balance });
      }
      const reservation: CreditReservation = {
        id: 'reservation-' + Math.random().toString(36).substring(7),
        userId,
        amount,
        createdAt: new Date(),
        status: 'pending',
      };
      reservations.set(reservation.id, reservation);
      balances.set(userId, balance - amount);
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
        const balance = balances.get(reservation.userId) ?? 0;
        balances.set(reservation.userId, balance + reservation.amount);
        reservation.status = 'refunded';
      }
    }),
    debit: vi.fn(async () => {}),
    _balances: balances,
    _reservations: reservations,
  };
}

/**
 * Creates a mock image generation service
 */
function createMockImageGenerationService() {
  return {
    generatePreview: vi.fn(async (prompt: string) => ({
      imageUrl: `https://replicate.com/temp/${Math.random().toString(36)}.png`,
      prompt,
    })),
  };
}

/**
 * Creates a mock storage service
 */
function createMockStorageService() {
  return {
    upload: vi.fn(async (tempUrl: string) =>
      `https://storage.googleapis.com/bucket/${Math.random().toString(36)}.png`
    ),
    uploadBatch: vi.fn(async (tempUrls: string[]) =>
      tempUrls.map(() => `https://storage.googleapis.com/bucket/${Math.random().toString(36)}.png`)
    ),
    uploadFromUrl: vi.fn(async (sourceUrl: string) =>
      `https://storage.googleapis.com/bucket/${Math.random().toString(36)}.png`
    ),
    uploadBuffer: vi.fn(async () =>
      `https://storage.googleapis.com/bucket/${Math.random().toString(36)}.png`
    ),
    delete: vi.fn(async () => {}),
  };
}

/**
 * Creates a mock depth estimation service
 */
function createMockDepthEstimationService() {
  return {
    estimateDepth: vi.fn(async () => 
      `https://storage.googleapis.com/bucket/depth-${Math.random().toString(36)}.png`
    ),
    isAvailable: vi.fn(() => true),
  };
}

/**
 * Creates a mock prompt builder service
 */
function createMockPromptBuilderService() {
  return {
    buildPrompt: vi.fn((options) => `${options.intent}, cinematic composition`),
    buildDimensionPreviewPrompt: vi.fn((intent) => `${intent}, preview prompt`),
    buildQuickGeneratePrompt: vi.fn((intent) => `${intent}, quick generate`),
    buildFinalFramePrompt: vi.fn((options) => `${options.intent}, final frame`),
    buildSubjectMotionPrompt: vi.fn((options) => `${options.intent}, ${options.subjectMotion}`),
    buildDirectionPrompts: vi.fn((intent) => [
      { direction: 'cinematic', prompt: `${intent}, cinematic` },
      { direction: 'social', prompt: `${intent}, social` },
      { direction: 'artistic', prompt: `${intent}, artistic` },
      { direction: 'documentary', prompt: `${intent}, documentary` },
    ]),
    buildRegeneratedPrompt: vi.fn((options) => `${options.intent}, regenerated`),
    buildRegeneratedDimensionPreviewPrompt: vi.fn((intent) => `${intent}, regenerated preview`),
    buildRegeneratedDirectionPrompts: vi.fn((intent) => [
      { direction: 'cinematic', prompt: `${intent}, cinematic regenerated` },
      { direction: 'social', prompt: `${intent}, social regenerated` },
      { direction: 'artistic', prompt: `${intent}, artistic regenerated` },
      { direction: 'documentary', prompt: `${intent}, documentary regenerated` },
    ]),
  };
}

/**
 * Creates a mock video preview service
 */
function createMockVideoPreviewService() {
  return {
    generatePreview: vi.fn(async () =>
      `https://storage.googleapis.com/bucket/video-${Math.random().toString(36)}.mp4`
    ),
    isAvailable: vi.fn(() => true),
  };
}

/**
 * Creates all mock dependencies for ConvergenceService
 */
function createMockDeps(): ConvergenceServiceDeps & {
  sessionStore: ReturnType<typeof createMockSessionStore>;
  creditsService: ReturnType<typeof createMockCreditsService>;
} {
  return {
    imageGenerationService: createMockImageGenerationService() as unknown as ConvergenceServiceDeps['imageGenerationService'],
    depthEstimationService: createMockDepthEstimationService() as unknown as ConvergenceServiceDeps['depthEstimationService'],
    sessionStore: createMockSessionStore() as unknown as ConvergenceServiceDeps['sessionStore'] & ReturnType<typeof createMockSessionStore>,
    promptBuilder: createMockPromptBuilderService() as unknown as ConvergenceServiceDeps['promptBuilder'],
    creditsService: createMockCreditsService() as unknown as ConvergenceServiceDeps['creditsService'] & ReturnType<typeof createMockCreditsService>,
    storageService: createMockStorageService() as unknown as ConvergenceServiceDeps['storageService'],
    videoPreviewService: createMockVideoPreviewService() as unknown as ConvergenceServiceDeps['videoPreviewService'],
  };
}

/**
 * Creates a test session with default values
 */
function createTestSession(overrides: Partial<ConvergenceSession> = {}): ConvergenceSession {
  return {
    id: 'test-session-id',
    userId: 'test-user-id',
    intent: 'A beautiful sunset over the ocean',
    aspectRatio: '16:9',
    direction: null,
    lockedDimensions: [],
    currentStep: 'direction',
    generatedImages: [],
    imageHistory: {},
    regenerationCounts: {},
    startingPointMode: 'converge',
    finalFrameUrl: null,
    finalFrameRegenerations: 0,
    uploadedImageUrl: null,
    depthMapUrl: null,
    cameraMotion: null,
    subjectMotion: null,
    finalPrompt: null,
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Creates a test generated image
 */
function createTestImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'test-image-id',
    url: 'https://storage.googleapis.com/bucket/test-image.png',
    dimension: 'direction',
    optionId: 'cinematic',
    prompt: 'A beautiful sunset, cinematic composition',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('ConvergenceService', () => {
  let service: ConvergenceService;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    service = new ConvergenceService(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    /**
     * Requirement 1.1: Session created with unique identifier and persisted to Firestore
     */
    it('should create a new session with unique ID', async () => {
      const result = await service.startSession(
        { intent: 'A beautiful sunset' },
        'user-123'
      );

      expect(result.sessionId).toBeDefined();
      expect(mockDeps.sessionStore.create).toHaveBeenCalled();
    });

    /**
     * Requirement 1.10-1.11: Only ONE active session per user at a time
     */
    it('should throw ACTIVE_SESSION_EXISTS if user has active session', async () => {
      const existingSession = createTestSession({ userId: 'user-123' });
      mockDeps.sessionStore.getActiveByUserId.mockResolvedValueOnce(existingSession);

      await expect(
        service.startSession({ intent: 'New intent' }, 'user-123')
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.startSession({ intent: 'New intent' }, 'user-123');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('ACTIVE_SESSION_EXISTS');
      }
    });

    it('should start at starting_point without generating images', async () => {
      const result = await service.startSession(
        { intent: 'A beautiful sunset' },
        'user-123'
      );

      expect(result.images).toHaveLength(0);
      expect(result.currentDimension).toBe('starting_point');
      expect(result.options).toBeUndefined();
    });

    it('should return zero estimated cost before starting point is selected', async () => {
      const result = await service.startSession(
        { intent: 'A beautiful sunset' },
        'user-123'
      );

      expect(result.estimatedCost).toBe(0);
    });

    /**
     * Requirement 15.6: Reserve credits when generation occurs
     */
    it('should not reserve credits before a starting point is chosen', async () => {
      await service.startSession({ intent: 'A beautiful sunset' }, 'user-123');

      expect(mockDeps.creditsService.reserve).not.toHaveBeenCalled();
      expect(mockDeps.creditsService.commit).not.toHaveBeenCalled();
    });

    it('should throw INSUFFICIENT_CREDITS if user lacks credits', async () => {
      mockDeps.creditsService._balances.set('poor-user', 0);

      await expect(
        service.startSession({ intent: 'A beautiful sunset' }, 'poor-user')
      ).rejects.toThrow(ConvergenceError);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const session = createTestSession();
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.getSession(session.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it('should return null for non-existent session', async () => {
      const result = await service.getSession('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveSession', () => {
    /**
     * Requirement 1.6: Resume incomplete sessions from previous visits
     */
    it('should return active session for user', async () => {
      const session = createTestSession({ userId: 'user-123', status: 'active' });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.getActiveSession('user-123');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
    });

    it('should return null when no active session exists', async () => {
      const result = await service.getActiveSession('user-without-session');

      expect(result).toBeNull();
    });
  });

  describe('selectOption', () => {
    it('should handle direction selection', async () => {
      const session = createTestSession({ userId: 'user-123' });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.selectOption(
        { sessionId: session.id, dimension: 'direction', optionId: 'cinematic' },
        'user-123'
      );

      expect(result.direction).toBe('cinematic');
      expect(result.currentDimension).toBe('mood');
    });

    it('should handle dimension selection', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        currentStep: 'mood',
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.selectOption(
        { sessionId: session.id, dimension: 'mood', optionId: 'dramatic' },
        'user-123'
      );

      expect(result.lockedDimensions).toHaveLength(1);
      expect(result.lockedDimensions[0]?.type).toBe('mood');
    });

    /**
     * Task 32.5: Test ownership validation (UNAUTHORIZED error)
     */
    it('should throw UNAUTHORIZED for wrong user', async () => {
      const session = createTestSession({ userId: 'user-123' });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await expect(
        service.selectOption(
          { sessionId: session.id, dimension: 'direction', optionId: 'cinematic' },
          'different-user'
        )
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.selectOption(
          { sessionId: session.id, dimension: 'direction', optionId: 'cinematic' },
          'different-user'
        );
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw SESSION_NOT_FOUND for non-existent session', async () => {
      await expect(
        service.selectOption(
          { sessionId: 'non-existent', dimension: 'direction', optionId: 'cinematic' },
          'user-123'
        )
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.selectOption(
          { sessionId: 'non-existent', dimension: 'direction', optionId: 'cinematic' },
          'user-123'
        );
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('SESSION_NOT_FOUND');
      }
    });
  });

  describe('regenerate', () => {
    /**
     * Task 32.6: Test regeneration limit (REGENERATION_LIMIT_EXCEEDED error)
     */
    it('should throw REGENERATION_LIMIT_EXCEEDED after 3 regenerations', async () => {
      const session = createTestSession({
        userId: 'user-123',
        regenerationCounts: { direction: 3 },
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await expect(
        service.regenerate({ sessionId: session.id, dimension: 'direction' }, 'user-123')
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.regenerate({ sessionId: session.id, dimension: 'direction' }, 'user-123');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('REGENERATION_LIMIT_EXCEEDED');
      }
    });

    it('should allow regeneration within limit', async () => {
      const session = createTestSession({
        userId: 'user-123',
        regenerationCounts: { direction: 2 },
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.regenerate(
        { sessionId: session.id, dimension: 'direction' },
        'user-123'
      );

      expect(result.remainingRegenerations).toBe(0);
      expect(result.images).toHaveLength(4);
    });

    it('should increment regeneration count', async () => {
      const session = createTestSession({
        userId: 'user-123',
        regenerationCounts: { direction: 1 },
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await service.regenerate(
        { sessionId: session.id, dimension: 'direction' },
        'user-123'
      );

      expect(mockDeps.sessionStore.update).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          regenerationCounts: expect.objectContaining({ direction: 2 }),
        })
      );
    });
  });

  describe('generateCameraMotion', () => {
    it('should generate depth map and return camera paths', async () => {
      const session = createTestSession({
        userId: 'user-123',
        generatedImages: [createTestImage({ dimension: 'lighting', optionId: 'golden_hour' })],
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.generateCameraMotion(
        { sessionId: session.id },
        'user-123'
      );

      expect(result.depthMapUrl).toBeDefined();
      expect(result.cameraPaths.length).toBeGreaterThanOrEqual(12);
      expect(result.cameraPaths.every((path) => path.id && path.label && path.category)).toBe(true);
      expect(result.fallbackMode).toBe(false);
    });

    it('should return fallback mode when depth estimation fails', async () => {
      const session = createTestSession({
        userId: 'user-123',
        generatedImages: [createTestImage({ dimension: 'lighting', optionId: 'golden_hour' })],
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      // Make depth estimation fail
      (mockDeps.depthEstimationService as ReturnType<typeof createMockDepthEstimationService>).estimateDepth.mockRejectedValueOnce(
        new Error('Depth estimation failed')
      );

      const result = await service.generateCameraMotion(
        { sessionId: session.id },
        'user-123'
      );

      expect(result.depthMapUrl).toBeNull();
      expect(result.fallbackMode).toBe(true);
      expect(result.cameraPaths.length).toBeGreaterThanOrEqual(12);
      expect(result.cameraPaths.every((path) => path.id && path.label && path.category)).toBe(true);
    });
  });

  describe('selectCameraMotion', () => {
    it('should lock camera motion selection', async () => {
      const session = createTestSession({ userId: 'user-123' });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await service.selectCameraMotion(
        { sessionId: session.id, cameraMotionId: 'push_in' },
        'user-123'
      );

      expect(mockDeps.sessionStore.update).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          cameraMotion: 'push_in',
          currentStep: 'subject_motion',
        })
      );
    });

    it('should throw error for invalid camera motion ID', async () => {
      const session = createTestSession({ userId: 'user-123' });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await expect(
        service.selectCameraMotion(
          { sessionId: session.id, cameraMotionId: 'invalid_motion' },
          'user-123'
        )
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.selectCameraMotion(
          { sessionId: session.id, cameraMotionId: 'invalid_motion' },
          'user-123'
        );
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('generateSubjectMotion', () => {
    it('should generate video preview', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        lockedDimensions: [],
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.generateSubjectMotion(
        { sessionId: session.id, subjectMotion: 'walking slowly' },
        'user-123'
      );

      expect(result.videoUrl).toBeDefined();
      expect(result.prompt).toBeDefined();
    });

    it('should store final prompt in session', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        lockedDimensions: [],
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await service.generateSubjectMotion(
        { sessionId: session.id, subjectMotion: 'walking slowly' },
        'user-123'
      );

      expect(mockDeps.sessionStore.update).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          subjectMotion: 'walking slowly',
          finalPrompt: expect.any(String),
        })
      );
    });
  });

  describe('finalizeSession', () => {
    /**
     * Task 32.7: Test finalization validation (INCOMPLETE_SESSION error)
     */
    it('should throw INCOMPLETE_SESSION when direction is missing', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: null,
        lockedDimensions: [],
        cameraMotion: null,
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await expect(
        service.finalizeSession(session.id, 'user-123')
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.finalizeSession(session.id, 'user-123');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INCOMPLETE_SESSION');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('direction');
      }
    });

    it('should throw INCOMPLETE_SESSION when required dimensions are missing', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        lockedDimensions: [
          { type: 'mood', optionId: 'dramatic', label: 'Dramatic', promptFragments: [] },
          // Missing framing and lighting
        ],
        cameraMotion: 'push_in',
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await expect(
        service.finalizeSession(session.id, 'user-123')
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.finalizeSession(session.id, 'user-123');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INCOMPLETE_SESSION');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('framing');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('lighting');
      }
    });

    it('should throw INCOMPLETE_SESSION when camera motion is missing', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        lockedDimensions: [
          { type: 'mood', optionId: 'dramatic', label: 'Dramatic', promptFragments: [] },
          { type: 'framing', optionId: 'wide', label: 'Wide', promptFragments: [] },
          { type: 'lighting', optionId: 'golden_hour', label: 'Golden Hour', promptFragments: [] },
        ],
        cameraMotion: null,
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await expect(
        service.finalizeSession(session.id, 'user-123')
      ).rejects.toThrow(ConvergenceError);

      try {
        await service.finalizeSession(session.id, 'user-123');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INCOMPLETE_SESSION');
        expect((error as ConvergenceError).details?.missingDimensions).toContain('camera_motion');
      }
    });

    it('should finalize complete session successfully', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        lockedDimensions: [
          { type: 'mood', optionId: 'dramatic', label: 'Dramatic', promptFragments: [] },
          { type: 'framing', optionId: 'wide', label: 'Wide', promptFragments: [] },
          { type: 'lighting', optionId: 'golden_hour', label: 'Golden Hour', promptFragments: [] },
        ],
        cameraMotion: 'push_in',
        generatedImages: [createTestImage()],
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      const result = await service.finalizeSession(session.id, 'user-123');

      expect(result.sessionId).toBe(session.id);
      expect(result.finalPrompt).toBeDefined();
      expect(result.cameraMotion).toBe('push_in');
      expect(result.generationCosts).toBeDefined();
    });

    it('should mark session as completed', async () => {
      const session = createTestSession({
        userId: 'user-123',
        direction: 'cinematic',
        lockedDimensions: [
          { type: 'mood', optionId: 'dramatic', label: 'Dramatic', promptFragments: [] },
          { type: 'framing', optionId: 'wide', label: 'Wide', promptFragments: [] },
          { type: 'lighting', optionId: 'golden_hour', label: 'Golden Hour', promptFragments: [] },
        ],
        cameraMotion: 'push_in',
        generatedImages: [createTestImage()],
      });
      mockDeps.sessionStore._sessions.set(session.id, session);

      await service.finalizeSession(session.id, 'user-123');

      expect(mockDeps.sessionStore.update).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          status: 'completed',
          currentStep: 'complete',
        })
      );
    });
  });

  describe('ownership validation', () => {
    /**
     * Task 32.5: Test ownership validation (UNAUTHORIZED error)
     */
    it('should throw UNAUTHORIZED for all operations with wrong user', async () => {
      const session = createTestSession({ userId: 'owner-user' });
      mockDeps.sessionStore._sessions.set(session.id, session);

      // Test selectOption
      await expect(
        service.selectOption(
          { sessionId: session.id, dimension: 'direction', optionId: 'cinematic' },
          'attacker-user'
        )
      ).rejects.toThrow(ConvergenceError);

      // Test regenerate
      await expect(
        service.regenerate({ sessionId: session.id, dimension: 'direction' }, 'attacker-user')
      ).rejects.toThrow(ConvergenceError);

      // Test generateCameraMotion
      session.generatedImages = [createTestImage()];
      await expect(
        service.generateCameraMotion({ sessionId: session.id }, 'attacker-user')
      ).rejects.toThrow(ConvergenceError);

      // Test selectCameraMotion
      await expect(
        service.selectCameraMotion(
          { sessionId: session.id, cameraMotionId: 'push_in' },
          'attacker-user'
        )
      ).rejects.toThrow(ConvergenceError);

      // Test generateSubjectMotion
      session.direction = 'cinematic';
      await expect(
        service.generateSubjectMotion(
          { sessionId: session.id, subjectMotion: 'walking' },
          'attacker-user'
        )
      ).rejects.toThrow(ConvergenceError);

      // Test finalizeSession
      await expect(
        service.finalizeSession(session.id, 'attacker-user')
      ).rejects.toThrow(ConvergenceError);
    });
  });
});
