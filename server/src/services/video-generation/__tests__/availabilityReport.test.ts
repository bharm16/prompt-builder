import { describe, expect, it } from 'vitest';
import { getAvailabilityReport } from '../availability';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoProviderAvailability } from '../types';

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
