import { describe, expect, it, vi } from 'vitest';
import type { ContinuitySession, ContinuityShot } from '../types';
import { ContinuityShotGenerator } from '../ContinuityShotGenerator';
import { ContinuitySessionVersionMismatchError } from '../ContinuitySessionStore';

const buildShot = (overrides: Partial<ContinuityShot> = {}): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 1,
  userPrompt: 'Prompt',
  generationMode: 'continuity',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-a' as ContinuityShot['modelId'],
  status: 'draft',
  frameBridge: {
    id: 'bridge-1',
    sourceVideoId: 'video-0',
    sourceShotId: 'shot-0',
    frameUrl: 'https://example.com/bridge.png',
    framePosition: 'last',
    frameTimestamp: 6,
    resolution: { width: 1280, height: 720 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:03.000Z'),
  },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildSession = (
  shotOverrides: Partial<ContinuityShot> = {},
  sessionOverrides: Partial<ContinuitySession> = {}
): ContinuitySession => {
  const previousShot = buildShot({
    id: 'shot-0',
    sequenceIndex: 0,
    status: 'completed',
    videoAssetId: 'video-0',
    seedInfo: {
      seed: 12,
      provider: 'replicate',
      modelId: 'model-a' as ContinuityShot['modelId'],
      extractedAt: new Date('2026-01-01T00:00:02.000Z'),
    },
  });
  const targetShot = buildShot(shotOverrides);

  return {
    id: 'session-1',
    userId: 'user-1',
    name: 'Session',
    primaryStyleReference: {
      id: 'style-1',
      sourceVideoId: 'video-0',
      sourceFrameIndex: 0,
      frameUrl: 'https://example.com/style.png',
      frameTimestamp: 0,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      extractedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    shots: [previousShot, targetShot],
    defaultSettings: {
      generationMode: 'continuity',
      defaultContinuityMode: 'frame-bridge',
      defaultStyleStrength: 0.6,
      defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
      autoExtractFrameBridge: false,
      useCharacterConsistency: false,
      autoRetryOnFailure: true,
      maxRetries: 1,
      qualityThresholds: {
        style: 0.75,
        identity: 0.6,
      },
    },
    status: 'active',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...sessionOverrides,
  };
};

const createGenerator = (session: ContinuitySession, overrides: Record<string, unknown> = {}) => {
  const providerService = {
    getProviderFromModel: vi.fn().mockReturnValue('replicate'),
    getCapabilities: vi.fn().mockReturnValue({
      supportsNativeStyleReference: false,
      supportsNativeCharacterReference: false,
      supportsStartImage: true,
      supportsSeedPersistence: true,
      supportsExtendVideo: false,
    }),
    assertProviderSupportsContinuity: vi.fn(),
    getInheritedSeed: vi.fn().mockReturnValue(undefined),
    getContinuityStrategy: vi.fn().mockReturnValue({ type: 'frame-bridge' }),
    buildSeedParam: vi.fn().mockReturnValue({}),
    buildGenerationOptions: vi.fn().mockResolvedValue({ options: {} }),
    extractSeed: vi.fn().mockReturnValue(null),
    shouldUseSceneProxy: vi.fn().mockReturnValue(false),
    ...(overrides.providerService as Record<string, unknown> | undefined),
  };

  const mediaService = {
    getVideoUrl: vi.fn().mockResolvedValue('https://example.com/video.mp4'),
    extractBridgeFrame: vi.fn(),
    generateVideo: vi.fn().mockResolvedValue({
      assetId: 'raw-asset-1',
      videoUrl: 'https://example.com/raw.mp4',
    }),
    getCharacterReferenceUrl: vi.fn().mockResolvedValue('https://example.com/char.png'),
    createStyleReferenceFromVideo: vi.fn(),
    extractRepresentativeFrame: vi.fn(),
    generateStyledKeyframe: vi.fn(),
    ...(overrides.mediaService as Record<string, unknown> | undefined),
  };

  const postProcessingService = {
    matchPalette: vi.fn().mockResolvedValue({
      applied: false,
      assetId: undefined,
      videoUrl: undefined,
    }),
    evaluateQuality: vi.fn().mockResolvedValue({
      passed: true,
      styleScore: 0.9,
      identityScore: 0.8,
    }),
    renderSceneProxy: vi.fn(),
    matchImagePalette: vi.fn(),
    ...(overrides.postProcessingService as Record<string, unknown> | undefined),
  };

  const sessionStore = {
    get: vi.fn().mockResolvedValue(session),
    save: vi.fn().mockResolvedValue(undefined),
    saveWithVersion: vi.fn().mockResolvedValue(2),
    ...(overrides.sessionStore as Record<string, unknown> | undefined),
  };

  const characterKeyframes = {
    generateKeyframe: vi.fn(),
    ...(overrides.characterKeyframes as Record<string, unknown> | undefined),
  };

  const generator = new ContinuityShotGenerator(
    providerService as never,
    mediaService as never,
    postProcessingService as never,
    characterKeyframes as never,
    sessionStore as never
  );

  return {
    generator,
    providerService,
    mediaService,
    postProcessingService,
    sessionStore,
    characterKeyframes,
  };
};

describe('ContinuityShotGenerator', () => {
  it('orchestrates a successful continuity generation and persists the result', async () => {
    const session = buildSession();
    const { generator, providerService, mediaService, sessionStore } = createGenerator(session, {
      providerService: {
        getInheritedSeed: vi.fn().mockReturnValue(123),
        buildSeedParam: vi.fn().mockReturnValue({ seed: 123 }),
        extractSeed: vi.fn().mockReturnValue({
          seed: 321,
          provider: 'replicate',
          modelId: 'model-a',
          extractedAt: new Date('2026-01-01T00:00:09.000Z'),
        }),
      },
      postProcessingService: {
        matchPalette: vi.fn().mockResolvedValue({
          applied: true,
          assetId: 'graded-asset-1',
          videoUrl: 'https://example.com/graded.mp4',
        }),
      },
    });

    const result = await generator.generateShot('session-1', 'shot-1');

    expect(providerService.assertProviderSupportsContinuity).toHaveBeenCalledWith('replicate', 'model-a');
    expect(providerService.buildSeedParam).toHaveBeenCalledWith('replicate', 123);
    expect(mediaService.generateVideo).toHaveBeenCalledWith(
      'Prompt',
      expect.objectContaining({ model: 'model-a', startImage: 'https://example.com/bridge.png', seed: 123 })
    );
    expect(result.status).toBe('completed');
    expect(result.videoAssetId).toBe('graded-asset-1');
    expect(result.continuityMechanismUsed).toBe('frame-bridge');
    expect(result.seedInfo?.seed).toBe(321);
    expect(sessionStore.saveWithVersion).toHaveBeenCalled();
  });

  it('fails when continuity mode resolves to no usable visual anchor', async () => {
    const session = buildSession(
      {},
      {
        defaultSettings: {
          ...buildSession().defaultSettings,
          generationMode: 'continuity',
        },
      }
    );
    delete (session.shots[1] as Partial<ContinuityShot>).frameBridge;

    const { generator, mediaService } = createGenerator(session, {
      providerService: {
        assertProviderSupportsContinuity: vi.fn(),
        getCapabilities: vi.fn().mockReturnValue({
          supportsNativeStyleReference: false,
          supportsNativeCharacterReference: false,
          supportsStartImage: false,
          supportsSeedPersistence: false,
          supportsExtendVideo: false,
        }),
      },
    });

    const result = await generator.generateShot('session-1', 'shot-1');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('visual anchor');
    expect(mediaService.generateVideo).not.toHaveBeenCalled();
  });

  it('retries once after quality-gate style failure and adjusts style strength', async () => {
    const session = buildSession({ styleStrength: 0.6 });
    const { generator, mediaService, postProcessingService } = createGenerator(session, {
      postProcessingService: {
        evaluateQuality: vi
          .fn()
          .mockResolvedValueOnce({ passed: false, styleScore: 0.4 })
          .mockResolvedValueOnce({ passed: true, styleScore: 0.88 }),
      },
    });

    const result = await generator.generateShot('session-1', 'shot-1');

    expect(mediaService.generateVideo).toHaveBeenCalledTimes(2);
    expect(postProcessingService.evaluateQuality).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.retryCount).toBe(1);
    expect(result.styleStrength).toBeCloseTo(0.7, 5);
    expect(result.qualityScore).toBe(1);
  });

  it('uses seed-only continuity mechanism in standard mode when inherited seed exists', async () => {
    const session = buildSession(
      {
        generationMode: 'standard',
        continuityMode: 'frame-bridge',
      },
      {
        defaultSettings: {
          ...buildSession().defaultSettings,
          generationMode: 'standard',
        },
      }
    );
    delete (session.shots[1] as Partial<ContinuityShot>).frameBridge;

    const { generator, providerService, mediaService } = createGenerator(session, {
      providerService: {
        getInheritedSeed: vi.fn().mockReturnValue(999),
        buildSeedParam: vi.fn().mockReturnValue({ seed: 999 }),
        getCapabilities: vi.fn().mockReturnValue({
          supportsNativeStyleReference: false,
          supportsNativeCharacterReference: false,
          supportsStartImage: true,
          supportsSeedPersistence: true,
          supportsExtendVideo: false,
        }),
      },
    });

    const result = await generator.generateShot('session-1', 'shot-1');

    expect(providerService.getInheritedSeed).toHaveBeenCalled();
    expect(providerService.buildSeedParam).toHaveBeenCalledWith('replicate', 999);
    expect(mediaService.generateVideo).toHaveBeenCalledWith(
      'Prompt',
      expect.objectContaining({ seed: 999 })
    );
    expect(result.status).toBe('completed');
    expect(result.continuityMechanismUsed).toBe('seed-only');
  });

  it('retries persistence when saveWithVersion hits a version mismatch', async () => {
    const session = buildSession();
    const { generator, sessionStore } = createGenerator(session, {
      sessionStore: {
        saveWithVersion: vi
          .fn()
          .mockRejectedValueOnce(
            new ContinuitySessionVersionMismatchError('session-1', 1, 2)
          )
          .mockResolvedValueOnce(2),
      },
    });

    const result = await generator.generateShot('session-1', 'shot-1');

    expect(result.status).toBe('completed');
    expect(sessionStore.saveWithVersion).toHaveBeenCalledTimes(2);
  });

  it('persists failed shot state through fallback session save when fresh session is missing', async () => {
    const session = buildSession();
    const { generator, sessionStore } = createGenerator(session, {
      mediaService: {
        generateVideo: vi.fn().mockRejectedValue(new Error('provider unavailable')),
      },
      sessionStore: {
        get: vi
          .fn()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(null),
      },
    });

    const result = await generator.generateShot('session-1', 'shot-1');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('provider unavailable');
    expect(sessionStore.save).toHaveBeenCalled();
  });
});
