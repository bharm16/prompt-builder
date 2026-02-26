import { describe, expect, it, vi } from 'vitest';
import {
  getAvailabilityReport,
  getAvailabilitySnapshot,
  getModelAvailability,
} from '../availability';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoModelId, VideoProviderAvailability } from '../types';

const unavailableProviders: VideoProviderAvailability = {
  replicate: false,
  openai: false,
  luma: false,
  kling: false,
  gemini: false,
};

const allProviders: VideoProviderAvailability = {
  replicate: true,
  openai: true,
  luma: true,
  kling: true,
  gemini: true,
};

const createLog = () => ({ warn: vi.fn() });

describe('getModelAvailability', () => {
  it('returns missing credential details for sora models', () => {
    const availability = getModelAvailability(VIDEO_MODELS.SORA_2, unavailableProviders, createLog());

    expect(availability).toMatchObject({
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'OPENAI_API_KEY',
      statusCode: 424,
      resolvedModelId: VIDEO_MODELS.SORA_2,
    });
  });

  it('returns missing credential details for luma models', () => {
    const availability = getModelAvailability(VIDEO_MODELS.LUMA_RAY3, unavailableProviders, createLog());

    expect(availability).toMatchObject({
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'LUMA_API_KEY',
      statusCode: 424,
      resolvedModelId: VIDEO_MODELS.LUMA_RAY3,
    });
  });

  it('returns missing credential details for kling models', () => {
    const availability = getModelAvailability(VIDEO_MODELS.KLING_V2_1, unavailableProviders, createLog());

    expect(availability).toMatchObject({
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'KLING_API_KEY',
      statusCode: 424,
      resolvedModelId: VIDEO_MODELS.KLING_V2_1,
    });
  });

  it('returns missing credential details for veo models', () => {
    const availability = getModelAvailability(VIDEO_MODELS.VEO_3, unavailableProviders, createLog());

    expect(availability).toMatchObject({
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'GEMINI_API_KEY',
      statusCode: 424,
      resolvedModelId: VIDEO_MODELS.VEO_3,
    });
  });

  it('returns replicate key requirement for non-specialized models', () => {
    const availability = getModelAvailability(VIDEO_MODELS.PRO, unavailableProviders, createLog());

    expect(availability).toMatchObject({
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'REPLICATE_API_TOKEN',
      statusCode: 424,
      resolvedModelId: VIDEO_MODELS.PRO,
    });
  });

  it('returns unsupported_model for unknown requested model', () => {
    const availability = getModelAvailability('not-a-model', allProviders, createLog());

    expect(availability).toMatchObject({
      available: false,
      reason: 'unsupported_model',
      statusCode: 400,
    });
  });

  it('auto-selects an available provider model when model is auto', () => {
    const providers: VideoProviderAvailability = {
      replicate: false,
      openai: true,
      luma: false,
      kling: false,
      gemini: false,
    };
    const availability = getModelAvailability('auto', providers, createLog());

    expect(availability).toMatchObject({
      id: 'auto',
      available: true,
      resolvedModelId: VIDEO_MODELS.SORA_2,
      requestedId: 'auto',
    });
  });

  it('returns unavailable auto selection when no providers are configured', () => {
    const availability = getModelAvailability('auto', unavailableProviders, createLog());

    expect(availability).toMatchObject({
      id: 'auto',
      available: false,
      reason: 'missing_credentials',
      statusCode: 424,
    });
  });
});

describe('getAvailabilityReport', () => {
  it('includes entitlement and i2v flags in availability payload', () => {
    const log = createLog();

    const report = getAvailabilityReport([VIDEO_MODELS.SORA_2], unavailableProviders, log);

    expect(report.availableModels).toEqual([]);
    expect(report.availableCapabilityModels).toEqual([]);
    expect(report.models[0]?.supportsI2V).toBe(true);
    expect(report.models[0]?.entitled).toBe(false);
    expect(report.models[0]?.planTier).toBe('unknown');
  });

  it('deduplicates model ids and lists only available canonical models', () => {
    const providers: VideoProviderAvailability = {
      ...allProviders,
      replicate: false,
      luma: false,
      kling: false,
      gemini: false,
    };
    const report = getAvailabilityReport(
      [VIDEO_MODELS.SORA_2, VIDEO_MODELS.SORA_2, VIDEO_MODELS.PRO],
      providers,
      createLog()
    );

    expect(report.models).toHaveLength(2);
    expect(report.availableModels).toEqual([VIDEO_MODELS.SORA_2]);
    expect(report.availableCapabilityModels).toContain(VIDEO_MODELS.SORA_2);
  });
});

describe('getAvailabilitySnapshot', () => {
  it('returns canonical availability snapshot entries', () => {
    const log = createLog();

    const snapshot = getAvailabilitySnapshot([VIDEO_MODELS.SORA_2], unavailableProviders, log);

    expect(snapshot.availableModelIds).toEqual([]);
    expect(snapshot.models[0]?.id).toBe(VIDEO_MODELS.SORA_2);
    expect(snapshot.models[0]?.reason).toBe('missing_credentials');
    expect(snapshot.models[0]?.requiredKey).toBe('OPENAI_API_KEY');
  });

  it('marks non-canonical IDs as unsupported', () => {
    const log = createLog();

    const snapshot = getAvailabilitySnapshot(['veo-3' as VideoModelId], allProviders, log);

    expect(snapshot.models[0]?.reason).toBe('unsupported_model');
    expect(log.warn).toHaveBeenCalledWith(
      'Non-canonical video model ID supplied to availability snapshot',
      { modelId: 'veo-3' }
    );
  });
});
