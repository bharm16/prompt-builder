import { useCallback, useMemo } from 'react';
import {
  resolveFieldState,
  type CapabilitiesSchema,
  type CapabilityField,
  type CapabilityValue,
  type CapabilityValues,
} from '@shared/capabilities';
import { useCapabilities } from '../../hooks/useCapabilities';

export type PromptInputFieldInfo = {
  field: CapabilityField;
  allowedValues: CapabilityValue[];
};

interface UsePromptInputCapabilitiesOptions {
  selectedModel?: string;
  generationParams: CapabilityValues;
}

interface UsePromptInputCapabilitiesResult {
  schema: CapabilitiesSchema | null;
  aspectRatioInfo: PromptInputFieldInfo | null;
  durationInfo: PromptInputFieldInfo | null;
  resolutionInfo: PromptInputFieldInfo | null;
  fpsInfo: PromptInputFieldInfo | null;
  audioInfo: { field: CapabilityField } | null;
}

export const usePromptInputCapabilities = ({
  selectedModel,
  generationParams,
}: UsePromptInputCapabilitiesOptions): UsePromptInputCapabilitiesResult => {
  const { schema } = useCapabilities(selectedModel);

  const getFieldInfo = useCallback(
    (fieldName: string): PromptInputFieldInfo | null => {
      if (!schema?.fields?.[fieldName]) return null;

      const field = schema.fields[fieldName];
      const state = resolveFieldState(field, generationParams);

      if (!state.available || state.disabled) return null;

      const allowedValues =
        field.type === 'enum' ? state.allowedValues ?? field.values ?? [] : [];

      return { field, allowedValues };
    },
    [schema, generationParams]
  );

  const aspectRatioInfo = useMemo(() => getFieldInfo('aspect_ratio'), [getFieldInfo]);
  const durationInfo = useMemo(() => getFieldInfo('duration_s'), [getFieldInfo]);
  const resolutionInfo = useMemo(() => getFieldInfo('resolution'), [getFieldInfo]);
  const fpsInfo = useMemo(() => getFieldInfo('fps'), [getFieldInfo]);

  const audioInfo = useMemo(() => {
    if (!schema?.fields?.audio) return null;
    const field = schema.fields.audio;
    const state = resolveFieldState(field, generationParams);
    if (!state.available || state.disabled) return null;
    return { field };
  }, [schema, generationParams]);

  return {
    schema,
    aspectRatioInfo,
    durationInfo,
    resolutionInfo,
    fpsInfo,
    audioInfo,
  };
};
