import { useState, useEffect } from 'react';
import { capabilitiesApi } from '@/services';
import { AI_MODEL_LABELS, AI_MODEL_PROVIDERS, type AIModelId } from '../components/constants';
import type { CapabilitiesSchema } from '@shared/capabilities';

export interface UseCapabilitiesResult {
  schema: CapabilitiesSchema | null;
  isLoading: boolean;
  error: string | null;
  target: {
    provider: string;
    model: string;
    label: string;
  };
}

const resolveLabel = (selectedModel?: string, resolvedModel?: string): string => {
  if (!selectedModel) {
    return 'Auto-detect';
  }

  const resolvedLabel = resolvedModel
    ? AI_MODEL_LABELS[resolvedModel as AIModelId]
    : undefined;

  return resolvedLabel || AI_MODEL_LABELS[selectedModel as AIModelId] || selectedModel;
};

const resolveTarget = (selectedModel?: string): { provider: string; model: string; label: string } => {
  if (!selectedModel) {
    return { provider: 'generic', model: 'auto', label: resolveLabel() };
  }

  const provider = AI_MODEL_PROVIDERS[selectedModel as AIModelId] ?? 'generic';
  const label = resolveLabel(selectedModel);
  return { provider, model: selectedModel, label };
};

export const useCapabilities = (selectedModel?: string): UseCapabilitiesResult => {
  const [target, setTarget] = useState(() => resolveTarget(selectedModel));
  const [schema, setSchema] = useState<CapabilitiesSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const newTarget = resolveTarget(selectedModel);
    setTarget(newTarget);
    let active = true;
    setIsLoading(true);
    setError(null);

    capabilitiesApi
      .getCapabilities(newTarget.provider, newTarget.model)
      .then((data) => {
        if (!active) return;
        setSchema(data);
        setTarget({
          provider: data.provider || newTarget.provider,
          model: data.model || newTarget.model,
          label: resolveLabel(selectedModel, data.model),
        });
      })
      .catch((err) => {
        if (!active) return;
        setSchema(null);
        setError(err instanceof Error ? err.message : 'Unable to load capabilities');
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedModel]);

  return { schema, isLoading, error, target };
};

