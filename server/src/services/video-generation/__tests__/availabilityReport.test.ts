import { describe, expect, it } from 'vitest';
import { getAvailabilityReport, getAvailabilitySnapshot } from '../availability';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoModelId, VideoProviderAvailability } from '../types';

describe('getAvailabilityReport', () => {
  it('includes entitlement and i2v flags in availability payload', () => {
    const providers: VideoProviderAvailability = {
      replicate: false,
      openai: false,
      luma: false,
      kling: false,
      gemini: false,
    };
    const log = { warn: () => {} };

    const report = getAvailabilityReport([VIDEO_MODELS.SORA_2], providers, log);

    expect(report.availableModels).toEqual([]);
    expect(report.availableCapabilityModels).toEqual([]);
    expect(report.models[0]?.supportsI2V).toBe(true);
    expect(report.models[0]?.entitled).toBe(false);
    expect(report.models[0]?.planTier).toBe('unknown');
  });
});

describe('getAvailabilitySnapshot', () => {
  it('returns canonical availability snapshot entries', () => {
    const providers: VideoProviderAvailability = {
      replicate: false,
      openai: false,
      luma: false,
      kling: false,
      gemini: false,
    };
    const log = { warn: () => {} };

    const snapshot = getAvailabilitySnapshot([VIDEO_MODELS.SORA_2], providers, log);

    expect(snapshot.availableModelIds).toEqual([]);
    expect(snapshot.models[0]?.id).toBe(VIDEO_MODELS.SORA_2);
    expect(snapshot.models[0]?.reason).toBe('missing_credentials');
  });

  it('marks non-canonical IDs as unsupported', () => {
    const providers: VideoProviderAvailability = {
      replicate: true,
      openai: true,
      luma: true,
      kling: true,
      gemini: true,
    };
    const log = { warn: () => {} };

    const snapshot = getAvailabilitySnapshot(['veo-3' as VideoModelId], providers, log);

    expect(snapshot.models[0]?.reason).toBe('unsupported_model');
  });
});
