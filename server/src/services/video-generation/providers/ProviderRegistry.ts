import type { VideoModelId, VideoProviderAvailability } from '../types';
import { isKlingModel, isLumaModel, isOpenAISoraModel, isVeoModel, resolveModelSelection } from '../modelResolver';
import type { ProviderClients } from './ProviderClients';

export function getProviderAvailability(clients: ProviderClients): VideoProviderAvailability {
  return {
    replicate: !!clients.replicate,
    openai: !!clients.openai,
    luma: !!clients.luma,
    kling: !!clients.klingApiKey,
    gemini: !!clients.geminiApiKey,
  };
}

export function resolveAutoModelId(providers: VideoProviderAvailability): VideoModelId | null {
  if (providers.replicate) {
    return resolveModelSelection('PRO').modelId;
  }
  if (providers.openai) {
    return 'sora-2';
  }
  if (providers.luma) {
    return 'luma-ray3';
  }
  if (providers.kling) {
    return 'kling-v2-1-master';
  }
  if (providers.gemini) {
    return 'google/veo-3';
  }
  return null;
}

export function resolveProviderForModel(modelId: VideoModelId): keyof VideoProviderAvailability {
  if (isOpenAISoraModel(modelId)) {
    return 'openai';
  }
  if (isLumaModel(modelId)) {
    return 'luma';
  }
  if (isKlingModel(modelId)) {
    return 'kling';
  }
  if (isVeoModel(modelId)) {
    return 'gemini';
  }
  return 'replicate';
}
