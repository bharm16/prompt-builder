import { logger } from '@infrastructure/Logger';
import type { StructuredOutputSchema } from './types';

export function validateStructuredOutput(
  data: unknown,
  schema: StructuredOutputSchema
): void {
  if (schema.type === 'array' && !Array.isArray(data)) {
    throw new Error('Expected array but got object');
  }

  if (schema.type === 'object' && Array.isArray(data)) {
    throw new Error('Expected object but got array');
  }

  if (schema.type === 'object' && schema.required && typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;
    for (const field of schema.required) {
      if (!(field in dataObj)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  if (
    schema.type === 'array' &&
    schema.items &&
    schema.items.required &&
    Array.isArray(data)
  ) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (typeof item === 'object' && item !== null) {
        const itemObj = item as Record<string, unknown>;
        for (const field of schema.items.required) {
          if (!(field in itemObj)) {
            throw new Error(
              `Missing required field '${field}' in array item at index ${i}`
            );
          }
        }
      }
    }
  }

  logger.debug('Schema validation passed');
}
