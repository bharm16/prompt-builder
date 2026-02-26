import type { VideoModelId, VideoModelKey } from './types';
import {
  isKlingModelId,
  isLumaModelId,
  isOpenAISoraModelId,
  isVeoModelId,
  resolveGenerationModelId,
  resolveGenerationModelSelection,
  type ModelResolution,
  type ModelResolutionSource,
} from '@services/video-models/ModelRegistry';

type LogSink = { warn: (message: string, meta?: Record<string, unknown>) => void };

export type { ModelResolutionSource, ModelResolution };

export function resolveModelSelection(
  model?: VideoModelKey | VideoModelId | string,
  log?: LogSink
): ModelResolution {
  return resolveGenerationModelSelection(model, log);
}

export function resolveModelId(
  model?: VideoModelKey | VideoModelId | string,
  log?: LogSink
): VideoModelId {
  return resolveGenerationModelId(model, log);
}

export function isOpenAISoraModel(modelId: VideoModelId) {
  return isOpenAISoraModelId(modelId);
}

export function isLumaModel(modelId: VideoModelId) {
  return isLumaModelId(modelId);
}

export function isKlingModel(modelId: VideoModelId) {
  return isKlingModelId(modelId);
}

export function isVeoModel(modelId: VideoModelId) {
  return isVeoModelId(modelId);
}
