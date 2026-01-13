import { resolveModelSelection, isKlingModel, isLumaModel, isOpenAISoraModel, isVeoModel } from './modelResolver';
import type { VideoAvailabilityReport, VideoModelAvailability, VideoProviderAvailability } from './types';
import { resolveAutoModelId } from './providers/ProviderRegistry';

type LogSink = { warn: (message: string, meta?: Record<string, unknown>) => void };

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

  if (isAuto && !autoModelId) {
    return {
      id: 'auto',
      available: false,
      reason: 'missing_credentials',
      statusCode: 424,
      message: 'No video generation providers are configured.',
    };
  }

  const normalizedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';

  if (model && normalizedModel !== 'auto' && resolution.resolvedBy === 'default') {
    return {
      id: model,
      available: false,
      reason: 'unsupported_model',
      statusCode: 400,
      message: `Unknown video model: ${model}`,
    };
  }

  if (isOpenAISoraModel(resolvedId)) {
    if (!providers.openai) {
      return {
        id: model || resolvedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'OPENAI_API_KEY',
        resolvedModelId: resolvedId,
        statusCode: 424,
        message: 'Sora video generation requires OPENAI_API_KEY.',
      };
    }
    return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
  }

  if (isLumaModel(resolvedId)) {
    if (!providers.luma) {
      return {
        id: model || resolvedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'LUMA_API_KEY',
        resolvedModelId: resolvedId,
        statusCode: 424,
        message: 'Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.',
      };
    }
    return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
  }

  if (isKlingModel(resolvedId)) {
    if (!providers.kling) {
      return {
        id: model || resolvedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'KLING_API_KEY',
        resolvedModelId: resolvedId,
        statusCode: 424,
        message: 'Kling video generation requires KLING_API_KEY.',
      };
    }
    return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
  }

  if (isVeoModel(resolvedId)) {
    if (!providers.gemini) {
      return {
        id: model || resolvedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'GEMINI_API_KEY',
        resolvedModelId: resolvedId,
        statusCode: 424,
        message: 'Veo video generation requires GEMINI_API_KEY.',
      };
    }
    return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
  }

  if (!providers.replicate) {
    return {
      id: model || resolvedId,
      available: false,
      reason: 'missing_credentials',
      requiredKey: 'REPLICATE_API_TOKEN',
      resolvedModelId: resolvedId,
      statusCode: 424,
      message: 'Replicate API token is required for the selected video model.',
    };
  }

  return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
}

export function getAvailabilityReport(
  modelIds: string[],
  providers: VideoProviderAvailability,
  log: LogSink
): VideoAvailabilityReport {
  const uniqueIds = Array.from(new Set(modelIds));
  const models = uniqueIds.map((id) => getModelAvailability(id, providers, log));
  const availableModels = models.filter((model) => model.available).map((model) => model.id);
  return { providers, models, availableModels };
}
