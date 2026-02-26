export const CAPABILITY_TO_CANONICAL_MODEL_ID: Record<string, string> = {
  'kling-26': 'kling-v2-1-master',
  'veo-4': 'google/veo-3',
  'wan-2.2': 'wan-video/wan-2.2-t2v-fast',
  'wan-2.5': 'wan-video/wan-2.5-i2v',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'luma-ray3': 'luma-ray3',
};

const SUPPORTED_CANONICAL_MODEL_IDS = new Set<string>([
  'kling-v2-1-master',
  'google/veo-3',
  'wan-video/wan-2.2-t2v-fast',
  'wan-video/wan-2.5-i2v',
  'sora-2',
  'sora-2-pro',
  'luma-ray3',
]);

export const CANONICAL_TO_CAPABILITY_MODEL_ID: Record<string, string> = {
  'kling-v2-1-master': 'kling-26',
  'google/veo-3': 'veo-4',
  'wan-video/wan-2.2-t2v-fast': 'wan-2.2',
  'wan-video/wan-2.5-i2v': 'wan-2.5',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'luma-ray3': 'luma-ray3',
};

export const toCapabilityModelId = (modelId?: string | null): string | null => {
  if (!modelId) return null;
  return CANONICAL_TO_CAPABILITY_MODEL_ID[modelId] ?? modelId;
};

export const toCanonicalModelId = (modelId?: string | null): string | null => {
  if (!modelId) return null;
  const mapped = CAPABILITY_TO_CANONICAL_MODEL_ID[modelId];
  if (mapped) return mapped;
  if (SUPPORTED_CANONICAL_MODEL_IDS.has(modelId)) return modelId;
  return null;
};
