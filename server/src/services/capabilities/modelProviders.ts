import { findProviderForModel } from './registry';

const MODEL_ID_ALIASES: Record<string, string> = {
  runway: 'runway-gen45',
  luma: 'luma-ray3',
  kling: 'kling-26',
  sora: 'sora-2',
  veo: 'veo-4',
  wan: 'wan-2.2',
  // Video-generation model keys/ids (used by /preview/video/generate)
  PRO: 'wan-2.2',
  DRAFT: 'wan-2.2',
  'wan-video/wan-2.2-t2v-fast': 'wan-2.2',
  'kling-v2-1-master': 'kling-26',
  'kwaivgi/kling-v2.1': 'kling-26',
  'google/veo-3': 'veo-4',
  'veo-3': 'veo-4',
};

const MODEL_PROVIDER_MAP: Record<string, string> = {
  'runway-gen45': 'runway',
  'luma-ray3': 'luma',
  'sora-2': 'openai',
  'veo-4': 'google',
  'kling-26': 'kling',
  'wan-2.2': 'wan',
};

export const resolveModelId = (modelId?: string | null): string | null => {
  if (!modelId) {
    return null;
  }
  return MODEL_ID_ALIASES[modelId] ?? modelId;
};

export const resolveProviderForModel = (modelId?: string | null): string | null => {
  const resolved = resolveModelId(modelId);
  if (!resolved) {
    return null;
  }
  return MODEL_PROVIDER_MAP[resolved] ?? findProviderForModel(resolved);
};
