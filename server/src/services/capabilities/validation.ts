import type {
  CapabilitiesSchema,
  CapabilityValues,
  CapabilityValue,
  CapabilityField,
} from '@shared/capabilities';
import { getDefaultValue, resolveFieldState } from '@shared/capabilities';
import { logger } from '@infrastructure/Logger';

export interface CapabilityValidationResult {
  ok: boolean;
  errors: string[];
  values: CapabilityValues;
}

const log = logger.child({ service: 'capabilitiesValidation' });
const OPERATION = 'validateCapabilityValues';
const CAMERA_MOTION_KEY = 'camera_motion_id';
const SUBJECT_MOTION_KEY = 'subject_motion';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isCapabilityValue = (value: unknown): value is CapabilityValue =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Allow-list for internal generation parameters that are not part of the
 * model capabilities schema but should survive sanitization.
 */
const ALLOWED_UNKNOWN_FIELDS = new Set([
  CAMERA_MOTION_KEY,
  SUBJECT_MOTION_KEY,
]);

const normalizeMotionString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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
  const providedCameraMotion = normalizeMotionString(provided[CAMERA_MOTION_KEY]);
  const providedSubjectMotion = normalizeMotionString(provided[SUBJECT_MOTION_KEY]);
  const hasMotionFields = Boolean(providedCameraMotion || providedSubjectMotion);
  const schemaFieldIds = new Set(Object.keys(schema.fields));
  const schemaUnknownFields = new Set(schema.unknown_fields ?? []);
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
    if (typeof value === 'undefined') {
      continue;
    }
    const error = validateFieldValue(fieldId, field, value, state.allowedValues);
    if (error) {
      errors.push(error);
    }
  }

  // Preserve allowed unknown fields when they contain primitive values.
  for (const [fieldId, value] of Object.entries(provided)) {
    if (schemaFieldIds.has(fieldId)) {
      continue;
    }
    const isAllowedUnknown =
      ALLOWED_UNKNOWN_FIELDS.has(fieldId) || schemaUnknownFields.has(fieldId);
    if (!isAllowedUnknown || !isCapabilityValue(value)) {
      continue;
    }
    values[fieldId] = value;
  }

  if (hasMotionFields) {
    const preservedCameraMotion = normalizeMotionString(values[CAMERA_MOTION_KEY]);
    const preservedSubjectMotion = normalizeMotionString(values[SUBJECT_MOTION_KEY]);
    const motionMeta = {
      operation: OPERATION,
      hasCameraMotion: Boolean(providedCameraMotion),
      hasSubjectMotion: Boolean(providedSubjectMotion),
      subjectMotionLength: providedSubjectMotion?.length ?? 0,
      schemaHasCameraMotionField: schemaFieldIds.has(CAMERA_MOTION_KEY),
      schemaHasSubjectMotionField: schemaFieldIds.has(SUBJECT_MOTION_KEY),
      schemaAllowsCameraMotionUnknown: schemaUnknownFields.has(CAMERA_MOTION_KEY),
      schemaAllowsSubjectMotionUnknown: schemaUnknownFields.has(SUBJECT_MOTION_KEY),
      preservedCameraMotion,
      preservedSubjectMotionLength: preservedSubjectMotion?.length ?? 0,
      errorsCount: errors.length,
    } as const;

    log.debug('Validated capability values with motion fields', motionMeta);

    if (providedCameraMotion && !preservedCameraMotion) {
      log.warn('Camera motion field was dropped during capability validation', motionMeta);
    }
    if (providedSubjectMotion && !preservedSubjectMotion) {
      log.warn('Subject motion field was dropped during capability validation', motionMeta);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    values,
  };
};
