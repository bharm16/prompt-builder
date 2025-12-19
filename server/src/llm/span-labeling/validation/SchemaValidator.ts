import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * JSON Schema validation for LLM span responses
 *
 * Uses AJV (Another JSON Validator) to ensure LLM responses
 * conform to the expected structure.
 */

// Get current file's directory for schema loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema
const schemaPath = join(__dirname, 'schemas', 'spanResponseSchema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;

// Configure AJV
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'failing',
  useDefaults: true,
});

// Compile schema validator
const validateResponseSchema: ValidateFunction = ajv.compile(schema);
const schemaCache = new WeakMap<object, ValidateFunction>();

function normalizeSchema(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;
  const schemaObj = input as Record<string, unknown>;

  if (schemaObj.schema && typeof schemaObj.schema === 'object') {
    return schemaObj.schema as Record<string, unknown>;
  }

  const { name, strict, ...rest } = schemaObj;
  void name;
  void strict;
  return rest;
}

/**
 * Validate LLM response against schema
 *
 * @param {Object} data - LLM response to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateSchema(data: unknown, schemaOverride?: Record<string, unknown>): boolean {
  if (!schemaOverride) {
    return validateResponseSchema(data);
  }

  let validator = schemaCache.get(schemaOverride as object);
  if (!validator) {
    const normalized = normalizeSchema(schemaOverride);
    if (!normalized) {
      return validateResponseSchema(data);
    }
    validator = ajv.compile(normalized);
    schemaCache.set(schemaOverride as object, validator);
  }

  return validator(data) as boolean;
}

/**
 * Get detailed validation errors
 *
 * @returns {Array} AJV error objects
 */
export function getSchemaErrors(override?: Record<string, unknown>): ErrorObject[] {
  if (!override) {
    return (validateResponseSchema.errors || []) as ErrorObject[];
  }

  const validator = schemaCache.get(override as object);
  if (!validator) {
    return (validateResponseSchema.errors || []) as ErrorObject[];
  }

  return (validator.errors || []) as ErrorObject[];
}

/**
 * Format schema validation errors for display
 *
 * @returns {string} Formatted error message
 */
export function formatSchemaErrors(override?: Record<string, unknown>): string {
  const errors = getSchemaErrors(override);
  return errors
    .map((err) => {
      const legacy = err as ErrorObject & { dataPath?: string };
      return `${legacy.dataPath || err.instancePath || ''} ${err.message}`;
    })
    .join('; ');
}

/**
 * Validate and throw on error
 *
 * @param {Object} data - Data to validate
 * @throws {Error} If validation fails
 */
export function validateSchemaOrThrow(data: unknown, schemaOverride?: Record<string, unknown>): void {
  const valid = validateSchema(data, schemaOverride);
  if (!valid) {
    throw new Error(`Schema validation failed: ${formatSchemaErrors(schemaOverride)}`);
  }
}
