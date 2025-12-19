/**
 * Formatting Utilities for Video Concept Builder
 *
 * Contains pure functions for formatting and displaying values.
 */

/**
 * Formats a camelCase or snake_case key into a human-readable label
 */
export function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
}

/**
 * Describes a nested value (array or object) as a readable string
 */
export function describeNestedValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([nestedKey, nestedValue]) => {
        if (Array.isArray(nestedValue)) {
          return `${formatLabel(nestedKey)}: ${nestedValue.join(', ')}`;
        }
        if (nestedValue && typeof nestedValue === 'object') {
          return `${formatLabel(nestedKey)}: ${describeNestedValue(nestedValue)}`;
        }
        return `${formatLabel(nestedKey)}: ${nestedValue}`;
      })
      .join('; ');
  }

  return String(value || '');
}

