/**
 * Validation schemas for enhancement suggestions
 */

interface JSONSchema {
  type: string;
  items?: JSONSchema;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  [key: string]: unknown;
}

/**
 * Get schema for enhancement suggestions
 */
export function getEnhancementSchema(isPlaceholder: boolean): JSONSchema {
  const required = ['text', 'explanation', ...(isPlaceholder ? ['category'] : [])];

  return {
    type: 'array',
    items: {
      type: 'object',
      required,
      properties: {
        text: { type: 'string' },
        category: { type: 'string' },
        explanation: { type: 'string' },
        slot: { type: 'string' },
        visual_focus: { type: 'string' },
      },
    },
  };
}

/**
 * Get schema for custom suggestions
 */
export function getCustomSuggestionSchema(): JSONSchema {
  return {
    type: 'array',
    items: {
      required: ['text'],
    },
  };
}

