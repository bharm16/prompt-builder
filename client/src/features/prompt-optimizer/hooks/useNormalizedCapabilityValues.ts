import { useEffect, useMemo } from 'react';
import type { CapabilitiesSchema, CapabilityValues } from '@shared/capabilities';
import {
  areCapabilityValuesEqual,
  sanitizeCapabilityValues,
} from '../utils/capabilities';

interface UseNormalizedCapabilityValuesOptions {
  schema: CapabilitiesSchema | null;
  generationParams: CapabilityValues;
  onChange: (params: CapabilityValues) => void;
}

export const useNormalizedCapabilityValues = ({
  schema,
  generationParams,
  onChange,
}: UseNormalizedCapabilityValuesOptions): CapabilityValues => {
  const normalizedValues = useMemo(() => {
    if (!schema) {
      return generationParams;
    }
    return sanitizeCapabilityValues(schema, generationParams);
  }, [schema, generationParams]);

  useEffect(() => {
    if (!schema) {
      return;
    }
    if (!areCapabilityValuesEqual(generationParams, normalizedValues)) {
      onChange(normalizedValues);
    }
  }, [schema, generationParams, normalizedValues, onChange]);

  return normalizedValues;
};
