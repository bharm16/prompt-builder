import type { VideoModelId, VideoProviderAvailability } from '../types';
import { resolveModelSelection } from '../modelResolver';
import { resolveProviderForGenerationModel } from '@services/video-models/ModelRegistry';
import type { VideoProviderMap } from './VideoProviders';

export function getProviderAvailability(providers: VideoProviderMap): VideoProviderAvailability {
  return {
    replicate: providers.replicate.isAvailable(),
    openai: providers.openai.isAvailable(),
    luma: providers.luma.isAvailable(),
    kling: providers.kling.isAvailable(),
    gemini: providers.gemini.isAvailable(),
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
  return resolveProviderForGenerationModel(modelId);
}
