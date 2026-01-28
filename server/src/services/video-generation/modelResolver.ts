import { VIDEO_MODELS } from '@config/modelConfig';
import type {
  KlingModelId,
  LumaModelId,
  SoraModelId,
  VeoModelId,
  VideoModelId,
  VideoModelKey,
} from './types';

const DEFAULT_VIDEO_MODEL = VIDEO_MODELS.PRO || 'wan-video/wan-2.2-t2v-fast';
const VIDEO_MODEL_IDS = new Set<VideoModelId>(Object.values(VIDEO_MODELS) as VideoModelId[]);

const SORA_MODEL_ALIASES: Record<string, SoraModelId> = {
  'openai/sora-2': 'sora-2',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
};

const KLING_MODEL_ALIASES: Record<string, KlingModelId> = {
  'kwaivgi/kling-v2.1': 'kling-v2-1-master',
  'kling-v2.1': 'kling-v2-1-master',
  'kling-26': 'kling-v2-1-master',
};

const VEO_MODEL_ALIASES: Record<string, VeoModelId> = {
  'google/veo-3': 'google/veo-3',
  'veo-3': 'google/veo-3',
  'veo-3.1': 'google/veo-3',
  'veo-3.1-generate-preview': 'google/veo-3',
  'veo-4': 'google/veo-3',
};

type LogSink = { warn: (message: string, meta?: Record<string, unknown>) => void };

const WAN_MODEL_ALIASES: Record<string, VideoModelId> = {
  'wan-2.2': 'wan-video/wan-2.2-t2v-fast',
};

export type ModelResolutionSource = 'default' | 'key' | 'alias' | 'id';

export interface ModelResolution {
  modelId: VideoModelId;
  resolvedBy: ModelResolutionSource;
  requested?: string;
}

export function resolveModelSelection(
  model?: VideoModelKey | VideoModelId | string,
  log?: LogSink
): ModelResolution {
  if (
    !model ||
    (typeof model === 'string' &&
      (model.trim().length === 0 || model.trim().toLowerCase() === 'auto'))
  ) {
    return { modelId: DEFAULT_VIDEO_MODEL, resolvedBy: 'default' };
  }

  const normalized = typeof model === 'string' ? model.trim() : model;

  if (Object.prototype.hasOwnProperty.call(VIDEO_MODELS, normalized)) {
    return {
      modelId: VIDEO_MODELS[normalized as VideoModelKey],
      resolvedBy: 'key',
      requested: String(model),
    };
  }

  if (typeof normalized === 'string' && Object.prototype.hasOwnProperty.call(SORA_MODEL_ALIASES, normalized)) {
    return {
      modelId: SORA_MODEL_ALIASES[normalized]!,
      resolvedBy: 'alias',
      requested: normalized,
    };
  }

  if (typeof normalized === 'string' && Object.prototype.hasOwnProperty.call(KLING_MODEL_ALIASES, normalized)) {
    return {
      modelId: KLING_MODEL_ALIASES[normalized]!,
      resolvedBy: 'alias',
      requested: normalized,
    };
  }

  if (typeof normalized === 'string' && Object.prototype.hasOwnProperty.call(VEO_MODEL_ALIASES, normalized)) {
    return {
      modelId: VEO_MODEL_ALIASES[normalized]!,
      resolvedBy: 'alias',
      requested: normalized,
    };
  }

  if (typeof normalized === 'string' && Object.prototype.hasOwnProperty.call(WAN_MODEL_ALIASES, normalized)) {
    return {
      modelId: WAN_MODEL_ALIASES[normalized]!,
      resolvedBy: 'alias',
      requested: normalized,
    };
  }

  if (normalized === 'luma') {
    return {
      modelId: 'luma-ray3',
      resolvedBy: 'alias',
      requested: String(model),
    };
  }

  if (VIDEO_MODEL_IDS.has(normalized as VideoModelId)) {
    return {
      modelId: normalized as VideoModelId,
      resolvedBy: 'id',
      requested: String(model),
    };
  }

  log?.warn('Unknown video model requested; falling back to default', { model });
  return { modelId: DEFAULT_VIDEO_MODEL, resolvedBy: 'default', requested: String(model) };
}

export function resolveModelId(
  model?: VideoModelKey | VideoModelId | string,
  log?: LogSink
): VideoModelId {
  return resolveModelSelection(model, log).modelId;
}

export function isOpenAISoraModel(modelId: VideoModelId): modelId is SoraModelId {
  return modelId === 'sora-2' || modelId === 'sora-2-pro';
}

export function isLumaModel(modelId: VideoModelId): modelId is LumaModelId {
  return modelId === 'luma-ray3';
}

export function isKlingModel(modelId: VideoModelId): modelId is KlingModelId {
  return modelId === 'kling-v2-1-master';
}

export function isVeoModel(modelId: VideoModelId): modelId is VeoModelId {
  return modelId === 'google/veo-3';
}
