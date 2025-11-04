/**
 * SuggestionsPanel Utility Functions
 *
 * Pure functions for compatibility rendering, keyboard hints, and data normalization.
 * Following VideoConceptBuilder pattern: utils/validation.js
 */

import { CheckCircle, AlertCircle } from 'lucide-react';
import { COMPATIBILITY_THRESHOLDS, MAX_KEYBOARD_SHORTCUTS } from '../config/panelConfig';

// ===========================
// COMPATIBILITY UTILITIES
// ===========================

/**
 * Get styling classes for compatibility badge based on score
 * @param {number} compatibility - Compatibility score (0-1)
 * @returns {Object} Styling configuration
 */
export function getCompatibilityStyles(compatibility) {
  if (typeof compatibility !== 'number') {
    return null;
  }

  let tone = 'text-neutral-500 bg-neutral-100 border border-neutral-200';
  let IconComponent = null;

  if (compatibility >= COMPATIBILITY_THRESHOLDS.HIGH) {
    tone = 'text-emerald-600 bg-emerald-50 border border-emerald-200';
    IconComponent = CheckCircle;
  } else if (compatibility < COMPATIBILITY_THRESHOLDS.LOW) {
    tone = 'text-amber-600 bg-amber-50 border border-amber-200';
    IconComponent = AlertCircle;
  }

  return {
    tone,
    IconComponent,
    percent: Math.round(compatibility * 100),
  };
}

/**
 * Render compatibility badge component
 * @param {number} compatibility - Compatibility score (0-1)
 * @returns {JSX.Element|null} Badge component or null
 */
export function renderCompatibilityBadge(compatibility) {
  const styles = getCompatibilityStyles(compatibility);
  if (!styles) return null;

  const { tone, IconComponent, percent } = styles;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${tone}`}>
      {IconComponent ? <IconComponent className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{percent}% fit</span>
    </div>
  );
}

// ===========================
// KEYBOARD HINT UTILITIES
// ===========================

/**
 * Compute keyboard hint text based on active state and suggestion count
 * @param {boolean} hasActiveSuggestions - Whether suggestions are active
 * @param {number} suggestionCount - Number of suggestions
 * @returns {string|null} Keyboard hint text or null
 */
export function computeKeyboardHint(hasActiveSuggestions, suggestionCount) {
  if (!hasActiveSuggestions || suggestionCount === 0) {
    return null;
  }

  const shortcutCount = Math.min(suggestionCount, MAX_KEYBOARD_SHORTCUTS);
  return `Use number keys 1-${shortcutCount} for quick selection`;
}

// ===========================
// LOADING SKELETON UTILITIES
// ===========================

/**
 * Calculate number of loading skeleton items to display
 * @param {number} textLength - Length of context text
 * @param {boolean} isPlaceholder - Whether showing placeholder suggestions
 * @returns {number} Number of skeleton items
 */
export function getLoadingSkeletonCount(textLength, isPlaceholder) {
  if (isPlaceholder) return 4;
  if (textLength < 20) return 6;
  if (textLength < 100) return 5;
  return 4;
}

// ===========================
// SUGGESTION NORMALIZATION
// ===========================

/**
 * Normalize suggestion to object format
 * @param {string|Object} suggestion - Suggestion (string or object)
 * @returns {Object} Normalized suggestion object
 */
export function normalizeSuggestion(suggestion) {
  return typeof suggestion === 'string' ? { text: suggestion } : suggestion;
}
