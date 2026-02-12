import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import type { ContinuitySessionService as ContinuitySessionServiceType } from '../ContinuitySessionService';
import type { ContinuityProviderService as ContinuityProviderServiceType } from '../ContinuityProviderService';
import type { ContinuityMediaService as ContinuityMediaServiceType } from '../ContinuityMediaService';
import type { ContinuityPostProcessingService as ContinuityPostProcessingServiceType } from '../ContinuityPostProcessingService';
import type { ContinuityShotGenerator as ContinuityShotGeneratorType } from '../ContinuityShotGenerator';
import type { ContinuitySession, ContinuityShot, StyleReference } from '../types';

let ContinuitySessionService: typeof ContinuitySessionServiceType;
let ContinuityProviderService: typeof ContinuityProviderServiceType;
let ContinuityMediaService: typeof ContinuityMediaServiceType;
let ContinuityPostProcessingService: typeof ContinuityPostProcessingServiceType;
let ContinuityShotGenerator: typeof ContinuityShotGeneratorType;
const mockStorageGetViewUrl = vi.hoisted(() => vi.fn());

vi.mock('@services/storage/StorageService', () => ({
  getStorageService: () => ({
    getViewUrl: mockStorageGetViewUrl,
  }),
}));

beforeAll(async () => {
  process.env.GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'test-bucket';
  ({
    ContinuitySessionService,
    ContinuityProviderService,
    ContinuityMediaService,
    ContinuityPostProcessingService,
    ContinuityShotGenerator,
  } = await import('../'));
});

const buildSession = (overrides: Partial<ContinuitySession> = {}): ContinuitySession => {
  const primaryStyleReference: StyleReference = {
    id: 'style-1',
    sourceVideoId: 'video-1',
    sourceFrameIndex: 0,
    frameUrl: 'https://example.com/frame.png',
    frameTimestamp: 0,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    extractedAt: new Date(),
  };

  return {
    id: 'session-1',
    userId: 'user-1',
    name: 'Session',
    primaryStyleReference,
    shots: [],
    defaultSettings: {
      generationMode: 'continuity',
      defaultContinuityMode: 'frame-bridge',
      defaultStyleStrength: 0.6,
      defaultModel: 'model-1' as any,
      autoExtractFrameBridge: false,
      useCharacterConsistency: false,
    },
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

const buildShot = (overrides: Partial<ContinuityShot> = {}): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Test prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1' as any,
  status: 'draft',
  createdAt: new Date(),
  ...overrides,
});

const buildService = (
  session: ContinuitySession,
  overrides: Partial<{
    anchorService: Record<string, unknown>;
    frameBridge: Record<string, unknown>;
    styleReference: Record<string, unknown>;
    characterKeyframes: Record<string, unknown> | null;
    providerAdapter: Record<string, unknown>;
    seedService: Record<string, unknown>;
    styleAnalysis: Record<string, unknown>;
    grading: Record<string, unknown>;
    qualityGate: Record<string, unknown>;
    sceneProxy: Record<string, unknown>;
    videoGenerator: Record<string, unknown>;
    assetService: Record<string, unknown>;
    sessionStore: Record<string, unknown>;
  }> = {}
) => {
  const anchorService = {
    assertProviderSupportsContinuity: vi.fn(),
    shouldUseSceneProxy: vi.fn().mockReturnValue(false),
    ...(overrides.anchorService ?? {}),
  };
  const frameBridge = {
    extractBridgeFrame: vi.fn(),
    extractRepresentativeFrame: vi.fn(),
    ...(overrides.frameBridge ?? {}),
  };
  const styleReference = {
    createFromVideo: vi.fn(),
    createFromImage: vi.fn(),
    generateStyledKeyframe: vi.fn(),
    ...(overrides.styleReference ?? {}),
  };
  const characterKeyframes =
    overrides.characterKeyframes === null
      ? null
      : {
          generateKeyframe: vi.fn(),
          ...(overrides.characterKeyframes ?? {}),
        };
  const providerAdapter = {
    getProviderFromModel: vi.fn().mockReturnValue('replicate'),
    getContinuityStrategy: vi.fn(),
    buildGenerationOptions: vi.fn().mockResolvedValue({ options: {} }),
    getCapabilities: vi.fn().mockReturnValue({
      supportsNativeStyleReference: false,
      supportsNativeCharacterReference: false,
      supportsStartImage: true,
      supportsSeedPersistence: true,
      supportsExtendVideo: false,
    }),
    ...(overrides.providerAdapter ?? {}),
  };
  const seedService = {
    getInheritedSeed: vi.fn().mockReturnValue(undefined),
    buildSeedParam: vi.fn().mockReturnValue({}),
    extractSeed: vi.fn().mockReturnValue(null),
    ...(overrides.seedService ?? {}),
  };
  const styleAnalysis = {
    analyzeForDisplay: vi.fn(),
    ...(overrides.styleAnalysis ?? {}),
  };
  const grading = {
    matchPalette: vi.fn().mockResolvedValue({ applied: false }),
    matchImagePalette: vi.fn().mockResolvedValue({ applied: false }),
    ...(overrides.grading ?? {}),
  };
  const qualityGate = {
    evaluate: vi.fn().mockResolvedValue({ passed: true }),
    ...(overrides.qualityGate ?? {}),
  };
  const sceneProxy = {
    renderFromProxy: vi.fn(),
    createProxyFromVideo: vi.fn(),
    ...(overrides.sceneProxy ?? {}),
  };
  const videoGenerator = {
    generateVideo: vi.fn().mockResolvedValue({ assetId: 'asset-1', videoUrl: 'https://example.com/video.mp4' }),
    getVideoUrl: vi.fn().mockResolvedValue('https://example.com/video.mp4'),
    ...(overrides.videoGenerator ?? {}),
  };
  const assetService = {
    getAssetForGeneration: vi.fn().mockResolvedValue({ primaryImageUrl: 'https://example.com/char.png' }),
    ...(overrides.assetService ?? {}),
  };
  const sessionStore = {
    save: vi.fn(),
    saveWithVersion: vi.fn().mockImplementation((_session: ContinuitySession) => Promise.resolve(2)),
    get: vi.fn().mockResolvedValue(session),
    findByUser: vi.fn(),
    delete: vi.fn(),
    ...(overrides.sessionStore ?? {}),
  };

  const providerService = new ContinuityProviderService(
    anchorService as any,
    providerAdapter as any,
    seedService as any
  );
  const mediaService = new ContinuityMediaService(
    frameBridge as any,
    styleReference as any,
    styleAnalysis as any,
    videoGenerator as any,
    assetService as any
  );
  const postProcessingService = new ContinuityPostProcessingService(
    grading as any,
    qualityGate as any,
    sceneProxy as any
  );
  const shotGenerator = new ContinuityShotGenerator(
    providerService,
    mediaService,
    postProcessingService,
    characterKeyframes as any,
    sessionStore as any
  );

  return {
    service: new ContinuitySessionService(
      providerService,
      mediaService,
      postProcessingService,
      shotGenerator,
      sessionStore as any
    ),
    providerAdapter,
    videoGenerator,
    sessionStore,
    seedService,
    frameBridge,
    styleReference,
    sceneProxy,
  };
};

describe('ContinuitySessionService', () => {
  beforeEach(() => {
    mockStorageGetViewUrl.mockReset();
  });

  it('fails continuity generation when no visual anchor is available', async () => {
    const shot = buildShot({
      continuityMode: 'frame-bridge',
      generationMode: 'continuity',
    });
    const session = buildSession({ shots: [shot] });
    const { service, providerAdapter } = buildService(session, {
      providerAdapter: {
        getCapabilities: vi.fn().mockReturnValue({
          supportsNativeStyleReference: false,
          supportsNativeCharacterReference: false,
          supportsStartImage: false,
          supportsSeedPersistence: false,
          supportsExtendVideo: false,
        }),
      },
    });
    providerAdapter.getContinuityStrategy.mockReturnValue({ type: 'frame-bridge' });

    const result = await service.generateShot(session.id, shot.id);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('visual anchor');
  });

  it('allows standard generation without a visual anchor', async () => {
    const shot = buildShot({
      continuityMode: 'frame-bridge',
      generationMode: 'standard',
    });
    const session = buildSession({
      defaultSettings: {
        generationMode: 'standard',
        defaultContinuityMode: 'frame-bridge',
        defaultStyleStrength: 0.6,
        defaultModel: 'model-1' as any,
        autoExtractFrameBridge: false,
        useCharacterConsistency: false,
      },
      shots: [shot],
    });
    const { service, providerAdapter, videoGenerator } = buildService(session);
    providerAdapter.getContinuityStrategy.mockReturnValue({ type: 'frame-bridge' });

    const result = await service.generateShot(session.id, shot.id);

    expect(videoGenerator.generateVideo).toHaveBeenCalled();
    expect(result.status).toBe('completed');
    expect(result.videoAssetId).toBe('asset-1');
  });

  it('returns updated session when initialPrompt is provided', async () => {
    const frame = {
      id: 'frame-1',
      sourceVideoId: 'video-1',
      sourceShotId: 'initial',
      frameUrl: 'https://example.com/frame.png',
      framePosition: 'representative',
      frameTimestamp: 1,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      extractedAt: new Date(),
    };
    const styleRef: StyleReference = {
      id: 'style-1',
      sourceVideoId: 'video-1',
      sourceFrameIndex: 0,
      frameUrl: 'https://example.com/frame.png',
      frameTimestamp: 1,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      extractedAt: new Date(),
    };

    let currentSession: ContinuitySession | null = null;
    const sessionStore = {
      save: vi.fn().mockImplementation(async (session: ContinuitySession) => {
        currentSession = session;
      }),
      get: vi.fn().mockImplementation(async () => currentSession),
      findByUser: vi.fn(),
      delete: vi.fn(),
    };

    const { service, providerAdapter } = buildService(buildSession(), {
      sessionStore,
      frameBridge: {
        extractRepresentativeFrame: vi.fn().mockResolvedValue(frame),
      },
      styleReference: {
        createFromVideo: vi.fn().mockResolvedValue(styleRef),
      },
      styleAnalysis: {
        analyzeForDisplay: vi.fn().mockResolvedValue({
          dominantColors: [],
          lightingDescription: 'Soft light',
          moodDescription: 'Calm',
          confidence: 0.8,
        }),
      },
    });

    providerAdapter.getContinuityStrategy.mockReturnValue({ type: 'native-style-ref' });

    const result = await service.createSession('user-1', {
      name: 'Session',
      sourceVideoId: 'video-1',
      initialPrompt: 'First shot',
    });

    expect(result.shots).toHaveLength(1);
    expect(result.shots[0]?.userPrompt).toBe('First shot');
  });

  it('allows seed-only generation in standard mode when provider supports seed persistence', async () => {
    const shot = buildShot({
      continuityMode: 'frame-bridge',
      generationMode: 'standard',
      modelId: 'model-1' as any,
    });
    const session = buildSession({ shots: [shot] });
    const { service, providerAdapter, videoGenerator, seedService } = buildService(session, {
      providerAdapter: {
        getContinuityStrategy: vi.fn().mockReturnValue({ type: 'frame-bridge' }),
        getCapabilities: vi.fn().mockReturnValue({
          supportsNativeStyleReference: false,
          supportsNativeCharacterReference: false,
          supportsStartImage: true,
          supportsSeedPersistence: true,
          supportsExtendVideo: false,
        }),
      },
      seedService: {
        getInheritedSeed: vi.fn().mockReturnValue(0),
        buildSeedParam: vi.fn().mockReturnValue({ seed: 0 }),
      },
    });

    const result = await service.generateShot(session.id, shot.id);

    expect(seedService.getInheritedSeed).toHaveBeenCalled();
    expect(videoGenerator.generateVideo).toHaveBeenCalledWith(
      shot.userPrompt,
      expect.objectContaining({ seed: 0 })
    );
    expect(result.status).toBe('completed');
    expect(providerAdapter.getContinuityStrategy).toHaveBeenCalled();
  });

  it('returns existing session immediately when sessionId already exists', async () => {
    const existingSession = buildSession({ id: 'session-existing' });
    const sessionStore = {
      save: vi.fn(),
      saveWithVersion: vi.fn(),
      get: vi.fn().mockResolvedValue(existingSession),
      findByUser: vi.fn(),
      delete: vi.fn(),
    };
    const { service } = buildService(buildSession(), { sessionStore });

    const result = await service.createSession('user-1', {
      sessionId: 'session-existing',
      name: 'Ignored name',
    });

    expect(result).toBe(existingSession);
    expect(sessionStore.save).not.toHaveBeenCalled();
  });

  it('supports storage-path source videos when asset-id URL lookup fails', async () => {
    mockStorageGetViewUrl.mockResolvedValue({
      viewUrl: 'https://storage.googleapis.com/example/users/user-1/generations/video.mp4?sig=abc',
      expiresAt: new Date().toISOString(),
      storagePath: 'users/user-1/generations/video.mp4',
    });
    const frame = {
      id: 'frame-1',
      sourceVideoId: 'users/user-1/generations/video.mp4',
      sourceShotId: 'initial',
      frameUrl: 'https://example.com/frame.png',
      framePosition: 'representative',
      frameTimestamp: 1,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      extractedAt: new Date(),
    };
    const styleRef: StyleReference = {
      id: 'style-1',
      sourceVideoId: 'users/user-1/generations/video.mp4',
      sourceFrameIndex: 0,
      frameUrl: 'https://example.com/frame.png',
      frameTimestamp: 1,
      resolution: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      extractedAt: new Date(),
    };

    const { service, videoGenerator } = buildService(buildSession(), {
      videoGenerator: {
        getVideoUrl: vi.fn().mockResolvedValue(null),
      },
      frameBridge: {
        extractRepresentativeFrame: vi.fn().mockResolvedValue(frame),
      },
      styleReference: {
        createFromVideo: vi.fn().mockResolvedValue(styleRef),
      },
      styleAnalysis: {
        analyzeForDisplay: vi.fn().mockResolvedValue({
          dominantColors: [],
          lightingDescription: 'Soft light',
          moodDescription: 'Calm',
          confidence: 0.8,
        }),
      },
    });

    const result = await service.createSession('user-1', {
      name: 'Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });

    expect(result.primaryStyleReference.sourceVideoId).toBe('users/user-1/generations/video.mp4');
    expect(videoGenerator.getVideoUrl).toHaveBeenCalledWith('users/user-1/generations/video.mp4');
    expect(mockStorageGetViewUrl).toHaveBeenCalledWith(
      'user-1',
      'users/user-1/generations/video.mp4'
    );
  });

  it('falls back to a synthetic style reference when ffprobe is unavailable', async () => {
    const videoUrl = 'https://example.com/video.mp4';
    const ffprobeMissingError = Object.assign(new Error('spawn ffprobe ENOENT'), {
      code: 'ENOENT',
      syscall: 'spawn ffprobe',
    });

    const { service, frameBridge, styleReference } = buildService(buildSession(), {
      videoGenerator: {
        getVideoUrl: vi.fn().mockResolvedValue(videoUrl),
      },
      frameBridge: {
        extractRepresentativeFrame: vi.fn().mockRejectedValue(ffprobeMissingError),
      },
      styleReference: {
        createFromVideo: vi
          .fn()
          .mockImplementation(async (sourceVideoId: string, frame: { frameUrl: string }) => ({
            id: 'style-fallback',
            sourceVideoId,
            sourceFrameIndex: 0,
            frameUrl: frame.frameUrl,
            frameTimestamp: 0,
            resolution: { width: 1920, height: 1080 },
            aspectRatio: '16:9',
            extractedAt: new Date(),
          })),
      },
      styleAnalysis: {
        analyzeForDisplay: vi.fn().mockResolvedValue({
          dominantColors: [],
          lightingDescription: 'Unknown',
          moodDescription: 'Unknown',
          confidence: 0.5,
        }),
      },
    });

    const result = await service.createSession('user-1', {
      name: 'Session',
      sourceVideoId: 'video-asset-1',
    });

    expect(frameBridge.extractRepresentativeFrame).toHaveBeenCalledWith(
      'user-1',
      'video-asset-1',
      videoUrl,
      'initial'
    );
    expect(styleReference.createFromVideo).toHaveBeenCalledWith(
      'video-asset-1',
      expect.objectContaining({
        sourceVideoId: 'video-asset-1',
        sourceShotId: 'initial',
        frameUrl: videoUrl,
        framePosition: 'representative',
        frameTimestamp: 0,
        aspectRatio: '16:9',
      })
    );
    expect(result.primaryStyleReference.sourceVideoId).toBe('video-asset-1');
    expect(result.primaryStyleReference.frameUrl).toBe(videoUrl);
  });

  it('adds shots with inherited defaults and previous style reference', async () => {
    const previousShot = buildShot({
      id: 'shot-0',
      sequenceIndex: 0,
      status: 'completed',
      continuityMode: 'style-match',
      generationMode: 'continuity',
      videoAssetId: 'video-0',
      frameBridge: {
        id: 'bridge-0',
        sourceVideoId: 'video-0',
        sourceShotId: 'shot-0',
        frameUrl: 'https://example.com/bridge.png',
        framePosition: 'last',
        frameTimestamp: 4,
        resolution: { width: 1280, height: 720 },
        aspectRatio: '16:9',
        extractedAt: new Date(),
      },
    });
    const session = buildSession({ shots: [previousShot] });
    const sessionStore = {
      save: vi.fn(),
      saveWithVersion: vi.fn(),
      get: vi.fn().mockResolvedValue(session),
      findByUser: vi.fn(),
      delete: vi.fn(),
    };
    const { service } = buildService(session, { sessionStore });

    const shot = await service.addShot({
      sessionId: session.id,
      prompt: 'Next shot',
    });

    expect(shot.sequenceIndex).toBe(1);
    expect(shot.styleReferenceId).toBe('shot-0');
    expect(shot.generationMode).toBe(session.defaultSettings.generationMode);
    expect(shot.continuityMode).toBe(session.defaultSettings.defaultContinuityMode);
    expect(shot.modelId).toBe(session.defaultSettings.defaultModel);
    expect(shot.frameBridge).toEqual(previousShot.frameBridge);
    expect(shot.status).toBe('draft');
    expect(sessionStore.save).toHaveBeenCalled();
  });

  it('merges camera fields and removes characterAssetId when set to null on update', async () => {
    const session = buildSession({
      shots: [
        buildShot({
          id: 'shot-update',
          characterAssetId: 'char-1',
          camera: { yaw: 8, pitch: 2 },
        }),
      ],
    });
    const sessionStore = {
      save: vi.fn(),
      saveWithVersion: vi.fn(),
      get: vi.fn().mockResolvedValue(session),
      findByUser: vi.fn(),
      delete: vi.fn(),
    };
    const { service } = buildService(session, { sessionStore });

    const updated = await service.updateShot(session.id, 'shot-update', {
      camera: { roll: 3, dolly: 1 },
      characterAssetId: null,
      styleStrength: 0.8,
    });

    expect(updated.camera).toEqual({ yaw: 8, pitch: 2, roll: 3, dolly: 1 });
    expect(updated.characterAssetId).toBeUndefined();
    expect(updated.styleStrength).toBe(0.8);
    expect(sessionStore.save).toHaveBeenCalled();
  });

  it('only applies allowed session setting keys', async () => {
    const session = buildSession();
    const sessionStore = {
      save: vi.fn(),
      saveWithVersion: vi.fn(),
      get: vi.fn().mockResolvedValue(session),
      findByUser: vi.fn(),
      delete: vi.fn(),
    };
    const { service } = buildService(session, { sessionStore });

    const updated = await service.updateSessionSettings(session.id, {
      defaultStyleStrength: 0.92,
      maxRetries: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unknownSetting: 'ignored' as any,
    } as any);

    expect(updated.defaultSettings.defaultStyleStrength).toBe(0.92);
    expect(updated.defaultSettings.maxRetries).toBe(3);
    expect((updated.defaultSettings as unknown as Record<string, unknown>).unknownSetting).toBeUndefined();
    expect(sessionStore.save).toHaveBeenCalled();
  });

  it('creates scene proxy from source shot and enables scene proxy usage when ready', async () => {
    const session = buildSession({
      shots: [
        buildShot({
          id: 'shot-1',
          videoAssetId: 'video-1',
          status: 'completed',
        }),
      ],
      defaultSettings: {
        ...buildSession().defaultSettings,
        useSceneProxy: false,
      },
    });
    const sessionStore = {
      save: vi.fn(),
      saveWithVersion: vi.fn(),
      get: vi.fn().mockResolvedValue(session),
      findByUser: vi.fn(),
      delete: vi.fn(),
    };
    const { service, videoGenerator, sceneProxy } = buildService(session, {
      sessionStore,
      sceneProxy: {
        createProxyFromVideo: vi.fn().mockResolvedValue({
          id: 'proxy-1',
          sourceVideoId: 'video-1',
          proxyType: 'depth-parallax',
          referenceFrameUrl: 'https://example.com/proxy.png',
          status: 'ready',
          createdAt: new Date(),
        }),
      },
    });

    const updated = await service.createSceneProxy(session.id, 'shot-1');

    expect(videoGenerator.getVideoUrl).toHaveBeenCalledWith('video-1');
    expect(sceneProxy.createProxyFromVideo).toHaveBeenCalledWith(
      session.userId,
      'video-1',
      'https://example.com/video.mp4'
    );
    expect(updated.sceneProxy?.id).toBe('proxy-1');
    expect(updated.defaultSettings.useSceneProxy).toBe(true);
    expect(sessionStore.save).toHaveBeenCalled();
  });
});
