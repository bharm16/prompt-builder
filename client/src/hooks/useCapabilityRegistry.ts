import { useEffect, useMemo, useState } from "react";
import type { CapabilitiesSchema } from "@shared/capabilities";
import { capabilitiesApi } from "@/services";

type Registry = Record<string, Record<string, CapabilitiesSchema>>;

interface UseCapabilityRegistryResult {
  registry: Registry | null;
  error: string | null;
  capabilityMap: Record<string, CapabilitiesSchema>;
  hasRegistry: boolean;
  isLoading: boolean;
}

const flattenRegistry = (
  registry: Registry | null,
): Record<string, CapabilitiesSchema> => {
  if (!registry) return {};
  const entries: Record<string, CapabilitiesSchema> = {};
  for (const models of Object.values(registry)) {
    for (const [id, schema] of Object.entries(models)) {
      entries[id] = schema;
    }
  }
  return entries;
};

export const useCapabilityRegistry = (): UseCapabilityRegistryResult => {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    capabilitiesApi
      .getRegistry()
      .then((loaded) => {
        if (!active) return;
        setRegistry(loaded);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const capabilityMap = useMemo(() => flattenRegistry(registry), [registry]);

  return useMemo(
    () => ({
      registry,
      error,
      capabilityMap,
      hasRegistry: Boolean(registry),
      isLoading,
    }),
    [registry, error, capabilityMap, isLoading],
  );
};
