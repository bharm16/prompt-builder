import {
  getDefaultValue,
  resolveFieldState,
  type CapabilitiesSchema,
  type CapabilityField,
  type CapabilityValue,
  type CapabilityValues,
} from '@shared/capabilities';

export const areCapabilityValuesEqual = (
  left: CapabilityValues,
  right: CapabilityValues
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => Object.is(left[key], right[key]));
};

const normalizeCapabilityValue = (
  field: CapabilityField,
  value: CapabilityValue | undefined
): CapabilityValue | undefined => {
  if (typeof value === 'undefined') {
    return getDefaultValue(field);
  }
  if (field.type === 'bool') {
    return typeof value === 'boolean' ? value : getDefaultValue(field);
  }
  if (field.type === 'int') {
    return typeof value === 'number' && Number.isFinite(value) ? value : getDefaultValue(field);
  }
  if (field.type === 'string') {
    return typeof value === 'string' ? value : getDefaultValue(field);
  }
  return value;
};

export const sanitizeCapabilityValues = (
  schema: CapabilitiesSchema,
  values: CapabilityValues
): CapabilityValues => {
  const next: CapabilityValues = {};

  for (const [fieldId, field] of Object.entries(schema.fields)) {
    const normalized = normalizeCapabilityValue(field, values[fieldId]);
    if (typeof normalized !== 'undefined') {
      next[fieldId] = normalized;
    }
  }

  for (const [fieldId, field] of Object.entries(schema.fields)) {
    const state = resolveFieldState(field, next);
    if (!state.available || state.disabled) {
      delete next[fieldId];
      continue;
    }

    if (field.type === 'enum' && state.allowedValues && state.allowedValues.length > 0) {
      const current = next[fieldId];
      const isValid = state.allowedValues.some((value) => Object.is(value, current));
      if (!isValid) {
        next[fieldId] = state.allowedValues[0];
      }
    }
  }

  return next;
};
