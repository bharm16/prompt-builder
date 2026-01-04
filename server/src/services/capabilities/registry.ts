import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { MANUAL_CAPABILITIES_REGISTRY } from './manualRegistry';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;

const GENERATED_REGISTRY_PATH = fileURLToPath(
  new URL('./registry.generated.json', import.meta.url)
);

const loadGeneratedRegistry = (): CapabilitiesRegistry | null => {
  try {
    if (!fs.existsSync(GENERATED_REGISTRY_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(GENERATED_REGISTRY_PATH, 'utf8');
    return JSON.parse(raw) as CapabilitiesRegistry;
  } catch {
    return null;
  }
};

const mergeRegistries = (
  base: CapabilitiesRegistry,
  overlay: CapabilitiesRegistry | null
): CapabilitiesRegistry => {
  if (!overlay) {
    return base;
  }

  const merged: CapabilitiesRegistry = { ...base };
  for (const [provider, models] of Object.entries(overlay)) {
    merged[provider] = { ...(merged[provider] || {}), ...models };
  }
  return merged;
};

export const CAPABILITIES_REGISTRY: CapabilitiesRegistry = mergeRegistries(
  MANUAL_CAPABILITIES_REGISTRY,
  loadGeneratedRegistry()
);

export const listProviders = (): string[] => Object.keys(CAPABILITIES_REGISTRY);

export const listModels = (provider: string): string[] => {
  return Object.keys(CAPABILITIES_REGISTRY[provider] || {});
};

export const getCapabilities = (provider: string, model: string): CapabilitiesSchema | null => {
  return CAPABILITIES_REGISTRY[provider]?.[model] ?? null;
};

export const findProviderForModel = (model: string): string | null => {
  for (const [provider, models] of Object.entries(CAPABILITIES_REGISTRY)) {
    if (models[model]) {
      return provider;
    }
  }
  return null;
};
