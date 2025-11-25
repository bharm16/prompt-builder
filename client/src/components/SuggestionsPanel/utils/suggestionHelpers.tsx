/**
 * SuggestionsPanel Utility Functions
 *
 * Pure functions for compatibility rendering, keyboard hints, and data normalization.
 * Following VideoConceptBuilder pattern: utils/validation.ts
 */

import { CheckCircle, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { COMPATIBILITY_THRESHOLDS, MAX_KEYBOARD_SHORTCUTS } from '../config/panelConfig';

// ===========================
// COMPATIBILITY UTILITIES
// ===========================

export interface CompatibilityStyles {
  tone: string;
  IconComponent: typeof CheckCircle | typeof AlertCircle | null;
  percent: number;
}

/**
 * Get styling classes for compatibility badge based on score
 */
export function getCompatibilityStyles(compatibility: number | undefined): CompatibilityStyles | null {
  if (typeof compatibility !== 'number') {
    return null;
  }

  let tone = 'text-neutral-500 bg-neutral-100 border border-neutral-200';
  let IconComponent: typeof CheckCircle | typeof AlertCircle | null = null;

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
 */
export function renderCompatibilityBadge(compatibility: number | undefined): React.ReactElement | null {
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
 */
export function computeKeyboardHint(hasActiveSuggestions: boolean, suggestionCount: number): string | null {
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
 */
export function getLoadingSkeletonCount(textLength: number, isPlaceholder: boolean): number {
  if (isPlaceholder) return 4;
  if (textLength < 20) return 6;
  if (textLength < 100) return 5;
  return 4;
}

// ===========================
// SUGGESTION NORMALIZATION
// ===========================

export interface NormalizedSuggestion {
  text: string;
  [key: string]: unknown;
}

/**
 * Normalize suggestion to object format
 */
export function normalizeSuggestion(suggestion: string | NormalizedSuggestion): NormalizedSuggestion {
  return typeof suggestion === 'string' ? { text: suggestion } : suggestion;
}

