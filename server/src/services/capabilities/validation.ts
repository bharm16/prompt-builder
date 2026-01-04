import type {
  CapabilitiesSchema,
  CapabilityValues,
  CapabilityValue,
  CapabilityField,
} from '@shared/capabilities';
import { getDefaultValue, resolveFieldState } from '@shared/capabilities';

export interface CapabilityValidationResult {
  ok: boolean;
  errors: string[];
  values: CapabilityValues;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const matchesStep = (value: number, step: number, min?: number): boolean => {
  if (step <= 0) return true;
  const base = typeof min === 'number' ? min : 0;
  const offset = value - base;
  const ratio = offset / step;
  const rounded = Math.round(ratio);
  return Math.abs(ratio - rounded) < 1e-9;
};

const validateFieldValue = (
  fieldId: string,
  field: CapabilityField,
  value: CapabilityValue,
  allowedValues?: CapabilityValue[]
): string | null => {
  switch (field.type) {
    case 'enum': {
      const options = allowedValues ?? field.values ?? [];
      const ok = options.some((option) => Object.is(option, value));
      return ok ? null : `Invalid value for ${fieldId}`;
    }
    case 'bool':
      return typeof value === 'boolean' ? null : `${fieldId} must be a boolean`;
    case 'string':
      return typeof value === 'string' ? null : `${fieldId} must be a string`;
    case 'int': {
      if (!isNumber(value) || !Number.isInteger(value)) {
        return `${fieldId} must be an integer`;
      }
      const { min, max, step } = field.constraints || {};
      if (typeof min === 'number' && value < min) {
        return `${fieldId} must be >= ${min}`;
      }
      if (typeof max === 'number' && value > max) {
        return `${fieldId} must be <= ${max}`;
      }
      if (typeof step === 'number' && !matchesStep(value, step, min)) {
        return `${fieldId} must align to step ${step}`;
      }
      return null;
    }
    default:
      return null;
  }
};

export const validateCapabilityValues = (
  schema: CapabilitiesSchema,
  input: CapabilityValues | null | undefined
): CapabilityValidationResult => {
  const provided = input ?? {};
  const providedKeys = new Set(Object.keys(provided));
  const values: CapabilityValues = {};
  const errors: string[] = [];

  for (const [fieldId, field] of Object.entries(schema.fields)) {
    if (hasOwn(provided, fieldId)) {
      values[fieldId] = provided[fieldId] as CapabilityValue;
      continue;
    }
    const defaultValue = getDefaultValue(field);
    if (typeof defaultValue !== 'undefined') {
      values[fieldId] = defaultValue;
    }
  }

  for (const [fieldId, field] of Object.entries(schema.fields)) {
    const state = resolveFieldState(field, values);

    if (!state.available) {
      if (providedKeys.has(fieldId)) {
        errors.push(`${fieldId} is not available for the current selection`);
      }
      delete values[fieldId];
      continue;
    }

    if (state.disabled) {
      if (providedKeys.has(fieldId)) {
        errors.push(`${fieldId} is disabled for the current selection`);
      }
      delete values[fieldId];
      continue;
    }

    if (!hasOwn(values, fieldId)) {
      continue;
    }

    const value = values[fieldId];
    const error = validateFieldValue(fieldId, field, value, state.allowedValues);
    if (error) {
      errors.push(error);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    values,
  };
};
