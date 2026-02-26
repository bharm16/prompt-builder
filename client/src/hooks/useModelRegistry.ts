import { useEffect, useMemo, useState } from 'react';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { capabilitiesApi } from '@/services';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { AI_MODEL_IDS, AI_MODEL_LABELS, AI_MODEL_PROVIDERS } from '@/config/videoModels';

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

const fallbackModels = (): ModelOption[] =>
  [...AI_MODEL_IDS]
    .map((id) => ({
      id,
      label: AI_MODEL_LABELS[id],
      provider: AI_MODEL_PROVIDERS[id],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

const log = logger.child('useModelRegistry');

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
        const resolved = flattenRegistry(registry);
        let availabilityApplied = false;
        let filtered = resolved;

        try {
          const availability = await capabilitiesApi.getVideoAvailability();
          const availabilityList =
            availability.availableCapabilityModels?.length
              ? availability.availableCapabilityModels
              : availability.availableModels;
          if (Array.isArray(availabilityList) && availabilityList.length > 0) {
            const availableSet = new Set(availabilityList);
            filtered = resolved.filter((model) => availableSet.has(model.id));
            if (filtered.length > 0) {
              availabilityApplied = true;
            } else {
              log.warn('Video availability returned no matching models', {
                operation: 'getVideoAvailability',
                availableModels: availability.availableModels,
              });
            }
          }
        } catch (availabilityError) {
          const info = sanitizeError(availabilityError);
          log.warn('Failed to load video availability', {
            operation: 'getVideoAvailability',
            error: info.message,
            errorName: info.name,
          });
        }

        if (availabilityApplied) {
          setModels(filtered);
        } else {
          setModels(resolved.length ? resolved : fallbackModels());
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Unable to load models';
        const errObj = err instanceof Error ? err : new Error(sanitizeError(err).message);
        log.warn('Failed to load models; using fallback list', {
          operation: 'fetchModels',
          error: errObj.message,
          errorName: errObj.name,
        });
        setError(message);
        // Ensure the UI still has a usable model list even if the registry endpoint is unavailable.
        setModels(fallbackModels());
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

  return useMemo(() => ({ models, isLoading, error }), [models, isLoading, error]);
};
