export type CapabilityValue = string | number | boolean;

export type CapabilityFieldType = 'enum' | 'int' | 'bool' | 'string';

export interface CapabilityCondition {
  field: string;
  eq?: CapabilityValue;
  neq?: CapabilityValue;
  in?: CapabilityValue[];
  not_in?: CapabilityValue[];
}

export interface CapabilityValueRule {
  if: CapabilityCondition;
  values: CapabilityValue[];
}

export interface CapabilityFieldConstraints {
  min?: number;
  max?: number;
  step?: number;
  available_if?: CapabilityCondition[];
  disabled_if?: CapabilityCondition[];
  available_values_if?: CapabilityValueRule[];
}

export interface CapabilityFieldUI {
  label?: string;
  control?: 'select' | 'segmented' | 'toggle' | 'input';
  group?: string;
  order?: number;
  description?: string;
  placeholder?: string;
}

export interface CapabilityField {
  type: CapabilityFieldType;
  values?: CapabilityValue[];
  default?: CapabilityValue;
  constraints?: CapabilityFieldConstraints;
  ui?: CapabilityFieldUI;
}

export interface ModelFeatures {
  text_to_video: boolean;
  image_to_video: boolean;
  video_to_video?: boolean;
}

export interface CapabilitiesSchema {
  provider: string;
  model: string;
  version: string;
  source?: string;
  generated_at?: string;
  features?: ModelFeatures;
  fields: Record<string, CapabilityField>;
  unknown_fields?: string[];
}

export type CapabilityValues = Record<string, CapabilityValue>;

export interface CapabilityFieldState {
  available: boolean;
  disabled: boolean;
  allowedValues?: CapabilityValue[];
}

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const isConditionMatch = (
  condition: CapabilityCondition,
  values: CapabilityValues
): boolean => {
  const current = values[condition.field];
  let match = true;

  if (hasOwn(condition, 'eq')) {
    match = match && Object.is(current, condition.eq);
  }
  if (hasOwn(condition, 'neq')) {
    match = match && !Object.is(current, condition.neq);
  }
  if (condition.in) {
    match = match && condition.in.some((value) => Object.is(current, value));
  }
  if (condition.not_in) {
    match = match && condition.not_in.every((value) => !Object.is(current, value));
  }

  return match;
};

export const areAllConditionsMet = (
  conditions: CapabilityCondition[] | undefined,
  values: CapabilityValues
): boolean => {
  if (!conditions || conditions.length === 0) {
    return true;
  }
  return conditions.every((condition) => isConditionMatch(condition, values));
};

export const resolveAllowedValues = (
  field: CapabilityField,
  values: CapabilityValues
): CapabilityValue[] => {
  const baseValues = Array.isArray(field.values) ? field.values : [];
  const rules = field.constraints?.available_values_if ?? [];

  for (const rule of rules) {
    if (isConditionMatch(rule.if, values)) {
      return rule.values;
    }
  }

  return baseValues;
};

export const resolveFieldState = (
  field: CapabilityField,
  values: CapabilityValues
): CapabilityFieldState => {
  const available = areAllConditionsMet(field.constraints?.available_if, values);
  const disabled = (field.constraints?.disabled_if ?? []).some((condition) =>
    isConditionMatch(condition, values)
  );
  const allowedValues =
    field.type === 'enum' ? resolveAllowedValues(field, values) : undefined;

  return { available, disabled, allowedValues };
};

export const getDefaultValue = (field: CapabilityField): CapabilityValue | undefined => {
  if (hasOwn(field, 'default')) {
    return field.default;
  }
  if (field.type === 'enum' && Array.isArray(field.values) && field.values.length > 0) {
    return field.values[0];
  }
  if (field.type === 'bool') {
    return false;
  }
  if (field.type === 'int' && typeof field.constraints?.min === 'number') {
    return field.constraints.min;
  }
  return undefined;
};
