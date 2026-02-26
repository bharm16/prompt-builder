import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIDEO_CREDITS_PER_SECOND,
  DEFAULT_VIDEO_DURATION_SECONDS,
  getVideoCost,
  getVideoCostBreakdown,
  getVideoCreditsPerSecond,
} from '../modelCosts';
import { VIDEO_MODELS } from '../modelConfig';

describe('modelCosts', () => {
  const draftRate = getVideoCreditsPerSecond(VIDEO_MODELS.DRAFT);
  const proRate = getVideoCreditsPerSecond(VIDEO_MODELS.PRO);
  const sora2Rate = getVideoCreditsPerSecond(VIDEO_MODELS.SORA_2);

  it('returns credits-per-second for known and unknown models', () => {
    expect(getVideoCreditsPerSecond(VIDEO_MODELS.DRAFT)).toBe(draftRate);
    expect(getVideoCreditsPerSecond('unknown-model')).toBe(DEFAULT_VIDEO_CREDITS_PER_SECOND);
    expect(getVideoCreditsPerSecond(undefined)).toBe(DEFAULT_VIDEO_CREDITS_PER_SECOND);
  });

  it('calculates cost with ceil rounding', () => {
    const cost = getVideoCost(VIDEO_MODELS.DRAFT, 3);
    expect(cost).toBe(Math.ceil(draftRate * 3));
  });

  it('uses default duration when duration is omitted', () => {
    const cost = getVideoCost(VIDEO_MODELS.PRO);
    expect(cost).toBe(Math.ceil(proRate * DEFAULT_VIDEO_DURATION_SECONDS));
  });

  it('returns consistent cost breakdown fields', () => {
    const breakdown = getVideoCostBreakdown(VIDEO_MODELS.SORA_2, 8);

    expect(breakdown).toEqual({
      creditsPerSecond: sora2Rate,
      duration: 8,
      totalCredits: Math.ceil(sora2Rate * 8),
      modelId: VIDEO_MODELS.SORA_2,
    });
  });

  it('returns unknown model id in breakdown fallback', () => {
    const breakdown = getVideoCostBreakdown(undefined, undefined);

    expect(breakdown.modelId).toBe('unknown');
    expect(breakdown.duration).toBe(DEFAULT_VIDEO_DURATION_SECONDS);
  });
});
