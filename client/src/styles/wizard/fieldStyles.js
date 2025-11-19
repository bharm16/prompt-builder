/**
 * Helper Functions for Field Styling
 */

import { PATTERNS } from './patterns.js';
import { COLOR_SCHEMES } from './colorSchemes.js';

/**
 * Get all styles for a field type
 * @param {string} fieldType - Type of field (subject, action, location, etc.)
 * @param {string} patternType - Type of pattern to apply (default: 'dots')
 * @returns {Object} Style configuration object
 */
export const getFieldStyles = (fieldType, patternType = 'dots') => {
  const scheme = COLOR_SCHEMES[fieldType] || COLOR_SCHEMES.subject;
  
  return {
    gradientFrom: scheme.gradient.from,
    gradientTo: scheme.gradient.to,
    iconGradientFrom: scheme.icon.from,
    iconGradientTo: scheme.icon.to,
    glowColor: scheme.glow,
    pattern: PATTERNS[patternType](scheme.pattern, 0.3)
  };
};

