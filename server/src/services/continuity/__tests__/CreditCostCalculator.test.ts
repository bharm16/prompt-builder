import { describe, expect, it, vi } from 'vitest';
import type { ContinuitySession, ContinuityShot } from '../types';

const { getVideoCostMock } = vi.hoisted(() => ({
  getVideoCostMock: vi.fn((modelId?: string) => {
    if (modelId === 'unknown-model') {
      return 11;
    }
    return 7;
  }),
}));

vi.mock('@config/modelCosts', () => ({
  getVideoCost: getVideoCostMock,
}));

import { CreditCostCalculator } from '../CreditCostCalculator';

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
    maxRetries: 1,
  },
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildShot = (
  overrides: Partial<ContinuityShot> = {}
): ContinuityShot => ({
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

describe('CreditCostCalculator', () => {
  it('calculates continuity style-match cost with style keyframe charge when no character consistency', () => {
    const session = buildSession({
      defaultSettings: {
        ...buildSession().defaultSettings,
        generationMode: 'continuity',
        useCharacterConsistency: false,
        maxRetries: 2,
      },
    });
    const shot = buildShot({ continuityMode: 'style-match', modelId: 'model-a' as ContinuityShot['modelId'] });

    const summary = CreditCostCalculator.calculateShotCost(shot, session);

    expect(getVideoCostMock).toHaveBeenCalledWith('model-a');
    expect(summary.generationMode).toBe('continuity');
    expect(summary.continuityMode).toBe('style-match');
    expect(summary.videoCost).toBe(7);
    expect(summary.extraCost).toBe(2);
    expect(summary.perAttemptCost).toBe(9);
    expect(summary.maxRetries).toBe(2);
    expect(summary.totalCost).toBe(27);
  });

  it('charges keyframe extra cost for style-match when character consistency is required', () => {
    const session = buildSession({
      defaultSettings: {
        ...buildSession().defaultSettings,
        useCharacterConsistency: true,
      },
    });
    const shot = buildShot({ continuityMode: 'style-match' });

    const summary = CreditCostCalculator.calculateShotCost(shot, session);

    expect(summary.extraCost).toBe(2);
    expect(summary.perAttemptCost).toBe(9);
    expect(summary.totalCost).toBe(18);
  });

  it('uses none continuity mode for standard generation and only charges character keyframe when present', () => {
    const session = buildSession({
      defaultSettings: {
        ...buildSession().defaultSettings,
        generationMode: 'standard',
        maxRetries: 0,
      },
    });
    const shot = buildShot({
      generationMode: 'standard',
      continuityMode: 'style-match',
      characterAssetId: 'char-1',
    });

    const summary = CreditCostCalculator.calculateShotCost(shot, session);

    expect(summary.generationMode).toBe('standard');
    expect(summary.continuityMode).toBe('none');
    expect(summary.extraCost).toBe(2);
    expect(summary.perAttemptCost).toBe(9);
    expect(summary.totalCost).toBe(9);
  });

  it('defaults maxRetries to 1 when missing', () => {
    const base = buildSession();
    const session = buildSession({
      defaultSettings: {
        ...base.defaultSettings,
        maxRetries: undefined,
      },
    });
    const shot = buildShot({ continuityMode: 'frame-bridge' });

    const summary = CreditCostCalculator.calculateShotCost(shot, session);

    expect(summary.extraCost).toBe(0);
    expect(summary.maxRetries).toBe(1);
    expect(summary.totalCost).toBe(14);
  });

  it('uses model-specific video cost for unknown models', () => {
    const session = buildSession();
    const shot = buildShot({ modelId: 'unknown-model' as ContinuityShot['modelId'] });

    const summary = CreditCostCalculator.calculateShotCost(shot, session);

    expect(summary.videoCost).toBe(11);
    expect(summary.perAttemptCost).toBe(11);
    expect(summary.totalCost).toBe(22);
  });
});
