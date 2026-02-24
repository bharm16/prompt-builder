import type { CapabilitiesSchema } from '../../shared/capabilities';

export interface ValidationError {
  model: string;
  field: string;
  error: string;
}

export function validateSchema(schema: CapabilitiesSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema.provider) {
    errors.push({ model: schema.model, field: '_root', error: 'missing provider' });
  }
  if (!schema.model) {
    errors.push({ model: schema.model, field: '_root', error: 'missing model' });
  }

  const fieldEntries = Object.entries(schema.fields || {});
  if (fieldEntries.length === 0) {
    errors.push({ model: schema.model, field: '_root', error: 'no fields defined' });
    return errors;
  }

  for (const [fieldId, field] of fieldEntries) {
    if (!field.type) {
      errors.push({ model: schema.model, field: fieldId, error: 'missing type' });
      continue;
    }

    if (field.type === 'enum') {
      if (!Array.isArray(field.values) || field.values.length === 0) {
        errors.push({ model: schema.model, field: fieldId, error: 'enum field has no values' });
      }
    }

    if (field.type === 'int') {
      const min = field.constraints?.min;
      const max = field.constraints?.max;
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors.push({ model: schema.model, field: fieldId, error: `min (${min}) > max (${max})` });
      }
    }

    if (!field.ui) {
      errors.push({ model: schema.model, field: fieldId, error: 'missing ui object' });
      continue;
    }

    if (!field.ui.label) {
      errors.push({ model: schema.model, field: fieldId, error: 'missing ui.label' });
    }
    if (!field.ui.control) {
      errors.push({ model: schema.model, field: fieldId, error: 'missing ui.control' });
    }
    if (!field.ui.group) {
      errors.push({ model: schema.model, field: fieldId, error: 'missing ui.group' });
    }
    if (field.ui.order === undefined) {
      errors.push({ model: schema.model, field: fieldId, error: 'missing ui.order' });
    }
  }

  return errors;
}
