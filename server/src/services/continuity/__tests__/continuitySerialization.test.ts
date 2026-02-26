import { describe, expect, it, vi } from 'vitest';
import type { ContinuitySession, ContinuityShot } from '../types';
import {
  deserializeContinuitySession,
  deserializeShot,
  serializeContinuitySession,
  type StoredContinuitySession,
} from '../continuitySerialization';

const buildShot = (overrides: Partial<ContinuityShot> = {}): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Prompt',
  continuityMode: 'style-match',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-a' as ContinuityShot['modelId'],
  status: 'completed',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  generatedAt: new Date('2026-01-01T00:00:10.000Z'),
  seedInfo: {
    seed: 42,
    provider: 'replicate',
    modelId: 'model-a' as ContinuityShot['modelId'],
    extractedAt: new Date('2026-01-01T00:00:03.000Z'),
  },
  frameBridge: {
    id: 'bridge-1',
    sourceVideoId: 'video-1',
    sourceShotId: 'shot-0',
    frameUrl: 'https://example.com/bridge.png',
    framePosition: 'last',
    frameTimestamp: 7.5,
    resolution: { width: 1280, height: 720 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:04.000Z'),
  },
  styleReference: {
    id: 'style-2',
    sourceVideoId: 'video-1',
    sourceFrameIndex: 6,
    frameUrl: 'https://example.com/style2.png',
    frameTimestamp: 6.1,
    resolution: { width: 1280, height: 720 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:05.000Z'),
  },
  ...overrides,
});

const buildSession = (overrides: Partial<ContinuitySession> = {}): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  description: 'Description',
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
  sceneProxy: {
    id: 'proxy-1',
    sourceVideoId: 'video-1',
    proxyType: 'depth-parallax',
    referenceFrameUrl: 'https://example.com/proxy.png',
    status: 'ready',
    createdAt: new Date('2026-01-01T00:00:02.000Z'),
  },
  shots: [buildShot()],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'style-match',
    defaultStyleStrength: 0.65,
    defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
    autoExtractFrameBridge: true,
    useCharacterConsistency: true,
    useSceneProxy: true,
    autoRetryOnFailure: true,
    maxRetries: 2,
    qualityThresholds: { style: 0.8, identity: 0.7 },
  },
  status: 'active',
  version: 4,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:20.000Z'),
  ...overrides,
});

describe('continuitySerialization', () => {
  it('serializes and deserializes continuity sessions with date fields preserved', () => {
    const session = buildSession();

    const stored = serializeContinuitySession(session);
    const restored = deserializeContinuitySession(session.id, stored);

    expect(restored.id).toBe(session.id);
    expect(restored.userId).toBe(session.userId);
    expect(restored.version).toBe(4);
    expect(restored.createdAt.getTime()).toBe(session.createdAt.getTime());
    expect(restored.updatedAt.getTime()).toBe(session.updatedAt.getTime());
    expect(restored.primaryStyleReference.extractedAt.getTime()).toBe(
      session.primaryStyleReference.extractedAt.getTime()
    );
    expect(restored.sceneProxy?.createdAt.getTime()).toBe(session.sceneProxy?.createdAt.getTime());

    const restoredShot = restored.shots[0];
    expect(restoredShot).toBeDefined();
    expect(restoredShot?.createdAt.getTime()).toBe(session.shots[0]?.createdAt.getTime());
    expect(restoredShot?.generatedAt?.getTime()).toBe(session.shots[0]?.generatedAt?.getTime());
    expect(restoredShot?.seedInfo?.seed).toBe(42);
    expect(restoredShot?.seedInfo?.extractedAt).toEqual(expect.any(Date));
    expect(restoredShot?.frameBridge?.extractedAt).toEqual(expect.any(Date));
    expect(restoredShot?.styleReference?.extractedAt).toEqual(expect.any(Date));
  });

  it('throws when deserializing invalid shot payloads', () => {
    const badShot = {
      id: 'shot-1',
      sessionId: 'session-1',
      sequenceIndex: 0,
      userPrompt: 'Prompt',
      continuityMode: 'frame-bridge',
      styleStrength: 0.5,
      styleReferenceId: null,
      modelId: 'model-a',
      status: 'draft',
      createdAt: 'not-a-number',
    } as unknown as Record<string, unknown>;

    expect(() => deserializeShot(badShot)).toThrow('Invalid shot data in Firestore');
  });

  it('falls back to current timestamps when optional nested date values are malformed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-11T12:00:00.000Z'));

    const stored: StoredContinuitySession = {
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
        extractedAt: 'bad-value',
      },
      sceneProxy: {
        id: 'proxy-1',
        sourceVideoId: 'video-1',
        proxyType: 'depth-parallax',
        referenceFrameUrl: 'https://example.com/proxy.png',
        status: 'ready',
        createdAt: 'bad-value',
      },
      shots: [
        {
          id: 'shot-1',
          sessionId: 'session-1',
          sequenceIndex: 0,
          userPrompt: 'Prompt',
          continuityMode: 'style-match',
          styleStrength: 0.5,
          styleReferenceId: null,
          modelId: 'model-a',
          status: 'draft',
          createdAt: Date.now(),
          seedInfo: {
            seed: 7,
            provider: 'replicate',
            modelId: 'model-a',
            extractedAt: 'bad-value',
          },
          frameBridge: {
            id: 'bridge-1',
            sourceVideoId: 'video-1',
            sourceShotId: 'shot-0',
            frameUrl: 'https://example.com/bridge.png',
            framePosition: 'last',
            frameTimestamp: 5,
            resolution: { width: 1280, height: 720 },
            aspectRatio: '16:9',
            extractedAt: 'bad-value',
          },
          styleReference: {
            id: 'style-2',
            sourceVideoId: 'video-1',
            sourceFrameIndex: 1,
            frameUrl: 'https://example.com/style2.png',
            frameTimestamp: 1,
            resolution: { width: 1280, height: 720 },
            aspectRatio: '16:9',
            extractedAt: 'bad-value',
          },
        },
      ],
      defaultSettings: {
        generationMode: 'continuity',
        defaultContinuityMode: 'frame-bridge',
        defaultStyleStrength: 0.6,
        defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
        autoExtractFrameBridge: false,
        useCharacterConsistency: false,
      },
      status: 'active',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    const restored = deserializeContinuitySession('session-1', stored);

    expect(restored.primaryStyleReference.extractedAt).toEqual(expect.any(Date));
    expect(restored.sceneProxy?.createdAt).toEqual(expect.any(Date));
    expect(restored.shots[0]?.seedInfo?.extractedAt).toEqual(expect.any(Date));
    expect(restored.shots[0]?.frameBridge?.extractedAt).toEqual(expect.any(Date));
    expect(restored.shots[0]?.styleReference?.extractedAt).toEqual(expect.any(Date));

    vi.useRealTimers();
  });

  it('omits undefined optional shot fields during serialization', () => {
    const shot = buildShot({
      status: 'draft',
      ...({
        generatedAt: undefined,
        frameBridge: undefined,
        styleReference: undefined,
        seedInfo: undefined,
      } as unknown as Partial<ContinuityShot>),
    });
    const session = buildSession({ shots: [shot] });

    const stored = serializeContinuitySession(session);
    const storedShot = stored.shots[0] as Record<string, unknown>;

    expect(storedShot).toBeDefined();
    expect(Object.hasOwn(storedShot, 'generatedAt')).toBe(false);
    expect(Object.hasOwn(storedShot, 'frameBridge')).toBe(false);
    expect(Object.hasOwn(storedShot, 'styleReference')).toBe(false);
    expect(Object.hasOwn(storedShot, 'seedInfo')).toBe(false);
  });
});
