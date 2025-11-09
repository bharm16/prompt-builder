/**
 * Validation schemas for enhancement suggestions
 */

/**
 * Get schema for enhancement suggestions
 * @param {boolean} isPlaceholder - Whether suggestions are for placeholder text
 * @returns {Object} Validation schema
 */
export function getEnhancementSchema(isPlaceholder) {
  return {
    type: 'array',
    items: {
      required: ['text', 'explanation', ...(isPlaceholder ? ['category'] : [])],
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

