import { beforeAll, describe, it, expect, vi } from 'vitest';
import type { ContinuitySessionService as ContinuitySessionServiceType } from '../ContinuitySessionService';
import type { ContinuitySession, ContinuityShot, StyleReference } from '../types';

let ContinuitySessionService: typeof ContinuitySessionServiceType;

beforeAll(async () => {
  process.env.GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'test-bucket';
  ({ ContinuitySessionService } = await import('../ContinuitySessionService'));
});

type ServiceDeps = ConstructorParameters<typeof ContinuitySessionServiceType>;

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

const buildService = (session: ContinuitySession) => {
  const anchorService = {
    assertProviderSupportsContinuity: vi.fn(),
    shouldUseSceneProxy: vi.fn().mockReturnValue(false),
  };
  const frameBridge = {
    extractBridgeFrame: vi.fn(),
    extractRepresentativeFrame: vi.fn(),
  };
  const styleReference = {
    createFromVideo: vi.fn(),
    createFromImage: vi.fn(),
    generateStyledKeyframe: vi.fn(),
  };
  const characterKeyframes = {
    generateKeyframe: vi.fn(),
  };
  const providerAdapter = {
    getProviderFromModel: vi.fn().mockReturnValue('replicate'),
    getContinuityStrategy: vi.fn(),
    buildGenerationOptions: vi.fn().mockResolvedValue({ options: {} }),
    getCapabilities: vi.fn().mockReturnValue({ supportsSeedPersistence: true }),
  };
  const seedService = {
    getInheritedSeed: vi.fn().mockReturnValue(undefined),
    buildSeedParam: vi.fn().mockReturnValue({}),
    extractSeed: vi.fn().mockReturnValue(null),
  };
  const styleAnalysis = {
    analyzeForDisplay: vi.fn(),
  };
  const grading = {
    matchPalette: vi.fn().mockResolvedValue({ applied: false }),
  };
  const qualityGate = {
    evaluate: vi.fn().mockResolvedValue({ passed: true }),
  };
  const sceneProxy = {
    renderFromProxy: vi.fn(),
    createProxyFromVideo: vi.fn(),
  };
  const videoGenerator = {
    generateVideo: vi.fn().mockResolvedValue({ assetId: 'asset-1', videoUrl: 'https://example.com/video.mp4' }),
    getVideoUrl: vi.fn().mockResolvedValue('https://example.com/video.mp4'),
  };
  const assetService = {
    getAssetForGeneration: vi.fn().mockResolvedValue({ primaryImageUrl: 'https://example.com/char.png' }),
  };
  const sessionStore = {
    save: vi.fn(),
    get: vi.fn().mockResolvedValue(session),
    findByUser: vi.fn(),
    delete: vi.fn(),
  };

  const deps: ServiceDeps = [
    anchorService as any,
    frameBridge as any,
    styleReference as any,
    characterKeyframes as any,
    providerAdapter as any,
    seedService as any,
    styleAnalysis as any,
    grading as any,
    qualityGate as any,
    sceneProxy as any,
    videoGenerator as any,
    assetService as any,
    sessionStore as any,
  ];

  return {
    service: new ContinuitySessionService(...deps),
    providerAdapter,
    videoGenerator,
    sessionStore,
  };
};

describe('ContinuitySessionService', () => {
  it('fails continuity generation when no visual anchor is available', async () => {
    const shot = buildShot({
      continuityMode: 'frame-bridge',
      generationMode: 'continuity',
    });
    const session = buildSession({ shots: [shot] });
    const { service, providerAdapter } = buildService(session);
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
});
