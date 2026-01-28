import {
  resolveModelSelection,
  isKlingModel,
  isLumaModel,
  isOpenAISoraModel,
  isVeoModel,
} from './modelResolver';
import type { VideoAvailabilityReport, VideoModelAvailability, VideoProviderAvailability } from './types';
import { resolveAutoModelId } from './providers/ProviderRegistry';
import { MANUAL_CAPABILITIES_REGISTRY } from '@services/capabilities/manualRegistry';
import { resolveModelId as resolveCapabilityModelId } from '@services/capabilities/modelProviders';

type LogSink = { warn: (message: string, meta?: Record<string, unknown>) => void };

export function getModelCapabilities(
  modelId: string
): { supportsImageInput: boolean; capabilityModelId: string | null } {
  const resolvedCapabilityId = resolveCapabilityModelId(modelId);
  const lookupId = resolvedCapabilityId ?? modelId;

  for (const [, models] of Object.entries(MANUAL_CAPABILITIES_REGISTRY)) {
    for (const [id, schema] of Object.entries(models)) {
      if (id === lookupId || schema.model === lookupId) {
        return {
          supportsImageInput: schema.fields?.image_input?.default === true,
          capabilityModelId: id,
        };
      }
    }
  }

  const i2vModels = ['sora-2', 'sora-2-pro', 'luma-ray3', 'kling-26', 'wan-2.2'];
  return {
    supportsImageInput: i2vModels.some((entry) => lookupId.includes(entry)),
    capabilityModelId: resolvedCapabilityId ?? null,
  };
}

export function getModelAvailability(
  model: string | null | undefined,
  providers: VideoProviderAvailability,
  log: LogSink
): VideoModelAvailability {
  const resolution = resolveModelSelection(model || undefined, log);
  const isAuto =
    !model ||
    (typeof model === 'string' &&
      (model.trim().length === 0 || model.trim().toLowerCase() === 'auto'));
  const autoModelId = isAuto ? resolveAutoModelId(providers) : null;
  const resolvedId = autoModelId || resolution.modelId;
  const capabilityInfo = getModelCapabilities(resolvedId);
  const requestedId = typeof model === 'string' && model.trim().length > 0 ? model.trim() : 'auto';

  if (isAuto && !autoModelId) {
    return {
      id: 'auto',
      requestedId: 'auto',
      available: false,
      reason: 'missing_credentials',
      statusCode: 424,
      message: 'No video generation providers are configured.',
      supportsI2V: false,
      entitled: false,
      planTier: 'unknown',
    };
  }

  const normalizedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';

  if (model && normalizedModel !== 'auto' && resolution.resolvedBy === 'default') {
    return {
      id: model,
      requestedId: model,
      available: false,
      reason: 'unsupported_model',
      statusCode: 400,
      message: `Unknown video model: ${model}`,
      supportsI2V: false,
      entitled: false,
      planTier: 'unknown',
    };
  }

  if (isOpenAISoraModel(resolvedId)) {
    if (!providers.openai) {
      return {
        id: model || resolvedId,
        requestedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'OPENAI_API_KEY',
        resolvedModelId: resolvedId,
        capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
        statusCode: 424,
        message: 'Sora video generation requires OPENAI_API_KEY.',
        supportsImageInput: capabilityInfo.supportsImageInput,
        supportsI2V: capabilityInfo.supportsImageInput,
        entitled: false,
        planTier: 'unknown',
      };
    }
    return {
      id: model || resolvedId,
      requestedId,
      available: true,
      resolvedModelId: resolvedId,
      capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
      supportsImageInput: capabilityInfo.supportsImageInput,
      supportsI2V: capabilityInfo.supportsImageInput,
      entitled: true,
      planTier: 'unknown',
    };
  }

  if (isLumaModel(resolvedId)) {
    if (!providers.luma) {
      return {
        id: model || resolvedId,
        requestedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'LUMA_API_KEY',
        resolvedModelId: resolvedId,
        capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
        statusCode: 424,
        message: 'Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.',
        supportsImageInput: capabilityInfo.supportsImageInput,
        supportsI2V: capabilityInfo.supportsImageInput,
        entitled: false,
        planTier: 'unknown',
      };
    }
    return {
      id: model || resolvedId,
      requestedId,
      available: true,
      resolvedModelId: resolvedId,
      capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
      supportsImageInput: capabilityInfo.supportsImageInput,
      supportsI2V: capabilityInfo.supportsImageInput,
      entitled: true,
      planTier: 'unknown',
    };
  }

  if (isKlingModel(resolvedId)) {
    if (!providers.kling) {
      return {
        id: model || resolvedId,
        requestedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'KLING_API_KEY',
        resolvedModelId: resolvedId,
        capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
        statusCode: 424,
        message: 'Kling video generation requires KLING_API_KEY.',
        supportsImageInput: capabilityInfo.supportsImageInput,
        supportsI2V: capabilityInfo.supportsImageInput,
        entitled: false,
        planTier: 'unknown',
      };
    }
    return {
      id: model || resolvedId,
      requestedId,
      available: true,
      resolvedModelId: resolvedId,
      capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
      supportsImageInput: capabilityInfo.supportsImageInput,
      supportsI2V: capabilityInfo.supportsImageInput,
      entitled: true,
      planTier: 'unknown',
    };
  }

  if (isVeoModel(resolvedId)) {
    if (!providers.gemini) {
      return {
        id: model || resolvedId,
        requestedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'GEMINI_API_KEY',
        resolvedModelId: resolvedId,
        capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
        statusCode: 424,
        message: 'Veo video generation requires GEMINI_API_KEY.',
        supportsImageInput: capabilityInfo.supportsImageInput,
        supportsI2V: capabilityInfo.supportsImageInput,
        entitled: false,
        planTier: 'unknown',
      };
    }
    return {
      id: model || resolvedId,
      requestedId,
      available: true,
      resolvedModelId: resolvedId,
      capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
      supportsImageInput: capabilityInfo.supportsImageInput,
      supportsI2V: capabilityInfo.supportsImageInput,
      entitled: true,
      planTier: 'unknown',
    };
  }

  if (!providers.replicate) {
    return {
      id: model || resolvedId,
      requestedId,
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'REPLICATE_API_TOKEN',
      resolvedModelId: resolvedId,
      capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
      statusCode: 424,
      message: 'Replicate API token is required for the selected video model.',
      supportsImageInput: capabilityInfo.supportsImageInput,
      supportsI2V: capabilityInfo.supportsImageInput,
      entitled: false,
      planTier: 'unknown',
    };
  }

  return {
    id: model || resolvedId,
    requestedId,
    available: true,
    resolvedModelId: resolvedId,
    capabilityModelId: capabilityInfo.capabilityModelId ?? undefined,
    supportsImageInput: capabilityInfo.supportsImageInput,
    supportsI2V: capabilityInfo.supportsImageInput,
    entitled: true,
    planTier: 'unknown',
  };
}

export function getAvailabilityReport(
  modelIds: string[],
  providers: VideoProviderAvailability,
  log: LogSink
): VideoAvailabilityReport {
  const uniqueIds = Array.from(new Set(modelIds));
  const models = uniqueIds.map((id) => getModelAvailability(id, providers, log));
  const availableModels = models
    .filter((model) => model.available)
    .map((model) => model.resolvedModelId ?? model.id);
  const availableCapabilityModels = models
    .filter((model) => model.available)
    .map((model) => model.capabilityModelId ?? model.id);

  return { providers, models, availableModels, availableCapabilityModels };
}
