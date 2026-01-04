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
};

const VEO_MODEL_ALIASES: Record<string, VeoModelId> = {
  'google/veo-3': 'google/veo-3',
  'veo-3': 'google/veo-3',
  'veo-3.1': 'google/veo-3',
  'veo-3.1-generate-preview': 'google/veo-3',
};

type LogSink = { warn: (message: string, meta?: Record<string, unknown>) => void };

export function resolveModelId(
  model?: VideoModelKey | VideoModelId,
  log?: LogSink
): VideoModelId {
  if (!model) {
    return DEFAULT_VIDEO_MODEL;
  }

  if (Object.prototype.hasOwnProperty.call(VIDEO_MODELS, model)) {
    return VIDEO_MODELS[model as VideoModelKey];
  }

  if (typeof model === 'string' && Object.prototype.hasOwnProperty.call(SORA_MODEL_ALIASES, model)) {
    return SORA_MODEL_ALIASES[model];
  }

  if (typeof model === 'string' && Object.prototype.hasOwnProperty.call(KLING_MODEL_ALIASES, model)) {
    return KLING_MODEL_ALIASES[model];
  }

  if (typeof model === 'string' && Object.prototype.hasOwnProperty.call(VEO_MODEL_ALIASES, model)) {
    return VEO_MODEL_ALIASES[model];
  }

  if (model === 'luma') {
    return 'luma-ray3';
  }

  if (VIDEO_MODEL_IDS.has(model as VideoModelId)) {
    return model as VideoModelId;
  }

  log?.warn('Unknown video model requested; falling back to default', { model });
  return DEFAULT_VIDEO_MODEL;
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
