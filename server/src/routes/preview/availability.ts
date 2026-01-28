import { getCapabilitiesRegistry } from '@services/capabilities';

let capabilityModelIdsCache: string[] | null = null;

export const getCapabilityModelIds = (): string[] => {
  if (capabilityModelIdsCache) {
    return capabilityModelIdsCache;
  }

  const ids = new Set<string>();
  for (const [provider, models] of Object.entries(getCapabilitiesRegistry())) {
    if (provider === 'generic') continue;
    for (const modelId of Object.keys(models)) {
      ids.add(modelId);
    }
  }
  capabilityModelIdsCache = Array.from(ids);
  return capabilityModelIdsCache;
};

export const emptyAvailability = () => ({
  providers: {
    replicate: false,
    openai: false,
    luma: false,
    kling: false,
    gemini: false,
  },
  models: [],
  availableModels: [],
});
