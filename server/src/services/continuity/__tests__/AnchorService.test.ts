import { describe, expect, it } from 'vitest';
import { AnchorService } from '../AnchorService';
import type { ContinuitySession, ContinuityShot } from '../types';

const buildSession = (
  overrides: Partial<ContinuitySession> = {}
): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  primaryStyleReference: {
    id: 'style-1',
    sourceVideoId: 'video-1',
    sourceFrameIndex: 0,
    frameUrl: 'https://example.com/style.png',
    frameTimestamp: 0,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  shots: [],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'frame-bridge',
    defaultStyleStrength: 0.6,
    defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
    autoExtractFrameBridge: false,
    useCharacterConsistency: false,
    useSceneProxy: false,
  },
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildShot = (overrides: Partial<ContinuityShot> = {}): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-a' as ContinuityShot['modelId'],
  status: 'draft',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('AnchorService', () => {
  it('allows continuity when provider supports start image', () => {
    const service = new AnchorService({
      getCapabilities: () => ({
        supportsStartImage: true,
        supportsNativeStyleReference: false,
        supportsNativeCharacterReference: false,
        supportsSeedPersistence: false,
        supportsExtendVideo: false,
      }),
    } as never);

    expect(() => service.assertProviderSupportsContinuity('replicate', 'model-a' as never)).not.toThrow();
  });

  it('allows continuity when provider supports native style reference', () => {
    const service = new AnchorService({
      getCapabilities: () => ({
        supportsStartImage: false,
        supportsNativeStyleReference: true,
        supportsNativeCharacterReference: false,
        supportsSeedPersistence: false,
        supportsExtendVideo: false,
      }),
    } as never);

    expect(() => service.assertProviderSupportsContinuity('runway', 'model-a' as never)).not.toThrow();
  });

  it('throws when provider supports neither start image nor style reference', () => {
    const service = new AnchorService({
      getCapabilities: () => ({
        supportsStartImage: false,
        supportsNativeStyleReference: false,
        supportsNativeCharacterReference: false,
        supportsSeedPersistence: false,
        supportsExtendVideo: false,
      }),
    } as never);

    expect(() => service.assertProviderSupportsContinuity('provider-x', 'model-a' as never)).toThrow(
      'Provider provider-x does not support continuity'
    );
  });

  it('uses scene proxy only when enabled, ready, and style-match mode', () => {
    const service = new AnchorService({ getCapabilities: () => ({}) } as never);
    const session = buildSession({
      sceneProxy: {
        id: 'proxy-1',
        sourceVideoId: 'video-1',
        proxyType: 'depth-parallax',
        referenceFrameUrl: 'https://example.com/proxy.png',
        status: 'ready',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      defaultSettings: {
        ...buildSession().defaultSettings,
        useSceneProxy: true,
      },
    });

    expect(
      service.shouldUseSceneProxy(session, buildShot({ continuityMode: 'style-match' }))
    ).toBe(true);

    expect(
      service.shouldUseSceneProxy(session, buildShot({ continuityMode: 'frame-bridge' }), 'frame-bridge')
    ).toBe(false);

    expect(
      service.shouldUseSceneProxy(session, buildShot({ continuityMode: 'frame-bridge' }), 'style-match')
    ).toBe(true);
  });

  it('does not use scene proxy when missing, disabled, or not ready', () => {
    const service = new AnchorService({ getCapabilities: () => ({}) } as never);

    expect(
      service.shouldUseSceneProxy(
        buildSession({
          defaultSettings: {
            ...buildSession().defaultSettings,
            useSceneProxy: false,
          },
          sceneProxy: {
            id: 'proxy-1',
            sourceVideoId: 'video-1',
            proxyType: 'depth-parallax',
            referenceFrameUrl: 'https://example.com/proxy.png',
            status: 'ready',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        }),
        buildShot({ continuityMode: 'style-match' })
      )
    ).toBe(false);

    expect(
      service.shouldUseSceneProxy(
        buildSession({
          defaultSettings: {
            ...buildSession().defaultSettings,
            useSceneProxy: true,
          },
          sceneProxy: {
            id: 'proxy-1',
            sourceVideoId: 'video-1',
            proxyType: 'depth-parallax',
            referenceFrameUrl: 'https://example.com/proxy.png',
            status: 'building',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        }),
        buildShot({ continuityMode: 'style-match' })
      )
    ).toBe(false);

    expect(
      service.shouldUseSceneProxy(
        buildSession({
          defaultSettings: {
            ...buildSession().defaultSettings,
            useSceneProxy: true,
          },
        }),
        buildShot({ continuityMode: 'style-match' })
      )
    ).toBe(false);
  });
});
