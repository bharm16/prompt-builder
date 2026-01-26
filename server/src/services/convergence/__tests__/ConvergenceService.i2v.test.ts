import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ConvergenceService, type ConvergenceServiceDeps } from '@services/convergence/ConvergenceService';
import { CONVERGENCE_COSTS } from '@services/convergence/constants';
import type { ConvergenceSession, LockedDimension } from '@services/convergence/types';

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

function createMockSessionStore() {
  const sessions = new Map<string, ConvergenceSession>();

  return {
    create: vi.fn(async (session: ConvergenceSession) => {
      sessions.set(session.id, session);
    }),
    get: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
    update: vi.fn(async (sessionId: string, updates: Partial<ConvergenceSession>) => {
      const session = sessions.get(sessionId);
      if (session) {
        sessions.set(sessionId, { ...session, ...updates });
      }
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
    abandonSession: vi.fn(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) return null;
      const updated = { ...session, status: 'abandoned' as const };
      sessions.set(sessionId, updated);
      return updated;
    }),
    _sessions: sessions,
  };
}

function createMockDeps(): ConvergenceServiceDeps & {
  sessionStore: ReturnType<typeof createMockSessionStore>;
} {
  const sessionStore = createMockSessionStore();

  return {
    sessionStore: sessionStore as unknown as ConvergenceServiceDeps['sessionStore'],
    imageGenerationService: {
      generatePreview: vi.fn(async (prompt: string) => ({
        imageUrl: `https://replicate.com/temp/${Math.random().toString(36)}.png`,
        prompt,
      })),
    } as unknown as ConvergenceServiceDeps['imageGenerationService'],
    depthEstimationService: {
      estimateDepth: vi.fn(async () => 'https://storage.example.com/depth.png'),
      isAvailable: vi.fn(() => true),
    } as unknown as ConvergenceServiceDeps['depthEstimationService'],
    promptBuilder: {
      buildQuickGeneratePrompt: vi.fn((intent: string) => `${intent}, quick generate`),
      buildFinalFramePrompt: vi.fn((options: { intent: string }) => `${options.intent}, final frame`),
      buildSubjectMotionPrompt: vi.fn((options: { intent: string; subjectMotion: string }) =>
        `${options.intent}, ${options.subjectMotion}`
      ),
      buildDirectionPrompts: vi.fn((intent: string) => [
        { direction: 'cinematic', prompt: `${intent}, cinematic` },
        { direction: 'social', prompt: `${intent}, social` },
        { direction: 'artistic', prompt: `${intent}, artistic` },
        { direction: 'documentary', prompt: `${intent}, documentary` },
      ]),
    } as unknown as ConvergenceServiceDeps['promptBuilder'],
    creditsService: {
      getBalance: vi.fn(async () => 100),
      reserve: vi.fn(async (userId: string, amount: number) => ({
        id: `reservation-${Math.random().toString(36)}`,
        userId,
        amount,
        createdAt: new Date(),
        status: 'pending' as const,
      })),
      commit: vi.fn(async () => {}),
      refund: vi.fn(async () => {}),
      debit: vi.fn(async () => {}),
    } as unknown as ConvergenceServiceDeps['creditsService'],
    storageService: {
      upload: vi.fn(async () => 'https://storage.example.com/generated.png'),
      uploadBatch: vi.fn(async (urls: string[], prefix: string) =>
        urls.map((_, index) => `https://storage.example.com/${prefix}/${index}.png`)
      ),
      uploadFromUrl: vi.fn(async (_url: string, prefix: string) =>
        `https://storage.example.com/${prefix}/${Math.random().toString(36)}.png`
      ),
      uploadBuffer: vi.fn(async () => 'https://storage.example.com/upload.png'),
      delete: vi.fn(async () => {}),
    } as unknown as ConvergenceServiceDeps['storageService'],
    videoPreviewService: {
      generatePreview: vi.fn(async () => 'https://storage.example.com/preview.mp4'),
      isAvailable: vi.fn(() => true),
    } as unknown as ConvergenceServiceDeps['videoPreviewService'],
  };
}

function createLockedDimension(type: LockedDimension['type'], optionId: string): LockedDimension {
  return {
    type,
    optionId,
    label: optionId,
    promptFragments: [`${optionId} fragment`],
  };
}

describe('ConvergenceService i2v Flow', () => {
  const userId = 'user-123';
  let service: ConvergenceService;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    mockDeps = createMockDeps();
    service = new ConvergenceService(mockDeps);
  });

  describe('setStartingPoint', () => {
    it('should handle upload mode correctly', async () => {
      const session = await service.startSession({ intent: 'test intent' }, userId);

      const result = await service.setStartingPoint(
        {
          sessionId: session.sessionId,
          mode: 'upload',
          imageUrl: 'https://example.com/image.jpg',
        },
        userId
      );

      expect(result.mode).toBe('upload');
      expect(result.nextStep).toBe('final_frame');
      expect(result.finalFrameUrl).toBeDefined();
      expect(result.creditsConsumed).toBe(0);
    });

    it('should handle quick mode correctly', async () => {
      const session = await service.startSession({ intent: 'test intent' }, userId);

      const result = await service.setStartingPoint(
        {
          sessionId: session.sessionId,
          mode: 'quick',
        },
        userId
      );

      expect(result.mode).toBe('quick');
      expect(result.nextStep).toBe('final_frame');
      expect(result.finalFrameUrl).toBeDefined();
      expect(result.creditsConsumed).toBe(CONVERGENCE_COSTS.QUICK_GENERATE);
    });

    it('should handle converge mode correctly', async () => {
      const session = await service.startSession({ intent: 'test intent' }, userId);

      const result = await service.setStartingPoint(
        {
          sessionId: session.sessionId,
          mode: 'converge',
        },
        userId
      );

      expect(result.mode).toBe('converge');
      expect(result.nextStep).toBe('direction');
      expect(result.images).toHaveLength(4);
      expect(result.creditsConsumed).toBe(CONVERGENCE_COSTS.DIRECTION_IMAGES);
    });
  });

  describe('generateFinalFrame', () => {
    it('should generate HQ frame after convergence', async () => {
      const session: ConvergenceSession = {
        id: 'session-final-frame',
        userId,
        intent: 'test intent',
        aspectRatio: '16:9',
        direction: 'cinematic',
        lockedDimensions: [
          createLockedDimension('mood', 'dramatic'),
          createLockedDimension('framing', 'wide'),
          createLockedDimension('lighting', 'golden_hour'),
        ],
        currentStep: 'lighting',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await mockDeps.sessionStore.create(session);

      const result = await service.generateFinalFrame({ sessionId: session.id }, userId);

      expect(result.finalFrameUrl).toBeDefined();
      expect(result.creditsConsumed).toBe(CONVERGENCE_COSTS.FINAL_FRAME_HQ);
    });
  });

  describe('generateSubjectMotion', () => {
    it('should use finalFrameUrl as startImage for i2v previews', async () => {
      const session: ConvergenceSession = {
        id: 'session-subject-motion',
        userId,
        intent: 'test intent',
        aspectRatio: '16:9',
        direction: 'cinematic',
        lockedDimensions: [
          createLockedDimension('mood', 'dramatic'),
          createLockedDimension('framing', 'wide'),
          createLockedDimension('lighting', 'golden_hour'),
        ],
        currentStep: 'subject_motion',
        generatedImages: [],
        imageHistory: {},
        regenerationCounts: {},
        startingPointMode: 'converge',
        finalFrameUrl: 'https://storage.example.com/final-frame.png',
        finalFrameRegenerations: 0,
        uploadedImageUrl: null,
        depthMapUrl: null,
        cameraMotion: 'push_in',
        subjectMotion: null,
        finalPrompt: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await mockDeps.sessionStore.create(session);

      const result = await service.generateSubjectMotion(
        { sessionId: session.id, subjectMotion: 'walking forward slowly' },
        userId
      );

      expect(result.inputMode).toBe('i2v');
      expect(result.startImageUrl).toBe(session.finalFrameUrl);
    });
  });
});
