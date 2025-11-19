/**
 * Configuration Module
 * 
 * Barrel export for all configuration constants and utilities.
 */

// Constants
export {
  DEFAULT_POLICY,
  DEFAULT_OPTIONS,
  DEBUG_HIGHLIGHTS,
  PERFORMANCE_MARKS,
  PERFORMANCE_MEASURES,
  DATASET_KEYS,
} from './constants.js';

// Debounce utilities
export { calculateSmartDebounce } from './debounce.js';

// Highlight styles
export {
  getHighlightClassName,
  HIGHLIGHT_STYLES,
  applyHighlightStyles,
} from './highlightStyles.js';

