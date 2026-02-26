import {
  resolveFieldState,
  type CapabilitiesSchema,
  type CapabilityField,
  type CapabilityFieldState,
  type CapabilityValue,
  type CapabilityValues,
} from '@shared/capabilities';

export interface FieldInfo {
  field: CapabilityField;
  state: CapabilityFieldState;
  allowedValues: CapabilityValue[];
}

export const getFieldInfo = (
  schema: CapabilitiesSchema | null,
  values: CapabilityValues,
  fieldName: string
): FieldInfo | null => {
  if (!schema?.fields?.[fieldName]) return null;
  const field = schema.fields[fieldName];
  if (!field) return null;
  const state = resolveFieldState(field, values);
  if (!state.available) return null;
  const allowedValues =
    field.type === 'enum'
      ? (state.allowedValues ?? field.values ?? [])
      : [];
  return { field, state, allowedValues };
};

export const resolveStringOptions = (
  allowedValues: CapabilityValue[] | undefined,
  fallback: string[]
): string[] => {
  const values = allowedValues ?? fallback;
  return values.map((value) => String(value));
};

export const resolveNumberOptions = (
  allowedValues: CapabilityValue[] | undefined,
  fallback: number[]
): number[] => {
  const values = allowedValues ?? fallback;
  return values.map((value) => Number(value));
};
