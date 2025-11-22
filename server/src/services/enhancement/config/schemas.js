/**
 * Validation schemas for enhancement suggestions
 */

/**
 * Get schema for enhancement suggestions
 * @param {boolean} isPlaceholder - Whether suggestions are for placeholder text
 * @returns {Object} Validation schema
 */
export function getEnhancementSchema(isPlaceholder) {
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
 * @returns {Object} Validation schema
 */
export function getCustomSuggestionSchema() {
  return {
    type: 'array',
    items: {
      required: ['text'],
    },
  };
}
