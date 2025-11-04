import Ajv from 'ajv';
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
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// Configure AJV
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'failing',
  useDefaults: true,
});

// Compile schema validator
const validateResponseSchema = ajv.compile(schema);

/**
 * Validate LLM response against schema
 *
 * @param {Object} data - LLM response to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateSchema(data) {
  return validateResponseSchema(data);
}

/**
 * Get detailed validation errors
 *
 * @returns {Array} AJV error objects
 */
export function getSchemaErrors() {
  return validateResponseSchema.errors || [];
}

/**
 * Format schema validation errors for display
 *
 * @returns {string} Formatted error message
 */
export function formatSchemaErrors() {
  const errors = getSchemaErrors();
  return errors
    .map((err) => `${err.dataPath || err.instancePath || ''} ${err.message}`)
    .join('; ');
}

/**
 * Validate and throw on error
 *
 * @param {Object} data - Data to validate
 * @throws {Error} If validation fails
 */
export function validateSchemaOrThrow(data) {
  const valid = validateSchema(data);
  if (!valid) {
    throw new Error(`Schema validation failed: ${formatSchemaErrors()}`);
  }
}
