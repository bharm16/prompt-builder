import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { MANUAL_CAPABILITIES_REGISTRY } from './manualRegistry';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;

const resolveGeneratedRegistryPath = (): string => {
  try {
    const url = new URL('./registry.generated.json', import.meta.url);
    if (url.protocol === 'file:') {
      return fileURLToPath(url);
    }
  } catch {
    // Fall through to cwd-based resolution below.
  }

  // Vitest/Vite can provide non-file import.meta.url values. In that case,
  // resolve from the project root (current working directory).
  return path.resolve(process.cwd(), 'server/src/services/capabilities/registry.generated.json');
};

const GENERATED_REGISTRY_PATH = resolveGeneratedRegistryPath();

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

let cachedRegistry: CapabilitiesRegistry | null = null;

const buildRegistry = (): CapabilitiesRegistry => {
  return mergeRegistries(MANUAL_CAPABILITIES_REGISTRY, loadGeneratedRegistry());
};

export const getCapabilitiesRegistry = (): CapabilitiesRegistry => {
  if (!cachedRegistry) {
    cachedRegistry = buildRegistry();
  }
  return cachedRegistry;
};

export const listProviders = (): string[] => Object.keys(getCapabilitiesRegistry());

export const listModels = (provider: string): string[] => {
  return Object.keys(getCapabilitiesRegistry()[provider] || {});
};

export const getCapabilities = (provider: string, model: string): CapabilitiesSchema | null => {
  return getCapabilitiesRegistry()[provider]?.[model] ?? null;
};

export const findProviderForModel = (model: string): string | null => {
  for (const [provider, models] of Object.entries(getCapabilitiesRegistry())) {
    if (models[model]) {
      return provider;
    }
  }
  return null;
};
