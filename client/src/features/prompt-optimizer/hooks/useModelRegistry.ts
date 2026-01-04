import { useEffect, useState } from 'react';
import { capabilitiesApi } from '@/services';
import { AI_MODEL_LABELS } from '../components/constants';
import type { CapabilitiesSchema } from '@shared/capabilities';

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
}

interface UseModelRegistryResult {
  models: ModelOption[];
  isLoading: boolean;
  error: string | null;
}

const formatProviderName = (provider: string): string =>
  provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : provider;

const resolveModelLabel = (provider: string, modelId: string): string => {
  const legacyLabel = AI_MODEL_LABELS[modelId as keyof typeof AI_MODEL_LABELS];
  return legacyLabel || `${formatProviderName(provider)} ${modelId}`;
};

const flattenRegistry = (
  registry: Record<string, Record<string, CapabilitiesSchema>>
): ModelOption[] => {
  const options: ModelOption[] = [];

  for (const [provider, models] of Object.entries(registry)) {
    if (provider === 'generic') continue;

    for (const modelId of Object.keys(models)) {
      options.push({
        id: modelId,
        label: resolveModelLabel(provider, modelId),
        provider,
      });
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
};

export const useModelRegistry = (): UseModelRegistryResult => {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchModels = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const registry = await capabilitiesApi.getRegistry();
        if (!active) return;
        setModels(flattenRegistry(registry));
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Unable to load models';
        console.error('Failed to load models:', err);
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchModels();
    return () => {
      active = false;
    };
  }, []);

  return { models, isLoading, error };
};
