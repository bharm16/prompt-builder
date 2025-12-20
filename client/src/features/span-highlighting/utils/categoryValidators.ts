import { TAXONOMY, VALID_CATEGORIES } from '@shared/taxonomy';

/**
 * Structural-Only Span Validation
 * 
 * This validator TRUSTS the backend AI's semantic categorization decisions.
 * It only validates structural integrity:
 * 1. Span has non-empty text
 * 2. Category is a valid taxonomy ID
 * 3. Text exists in the source at the claimed position
 * 
 * REMOVED: All semantic regex patterns (camera motion terms, lighting patterns, etc.)
 * RATIONALE: Backend LLM understands semantic meaning better than regex patterns.
 *            Example: "the view drifts slowly" is correctly identified as camera movement
 *            by the AI but would be rejected by regex patterns looking for "dolly" or "pan".
 */

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// ============================================================================

/**
 * Maps old flat IDs to new Taxonomy IDs on the fly.
 * Provides backward compatibility during migration.
 */
export const LEGACY_MAPPINGS: Record<string, string> = {
  'cameramove': TAXONOMY.CAMERA.attributes.MOVEMENT,
  'aesthetic': TAXONOMY.STYLE.attributes.AESTHETIC,
  'timeOfDay': TAXONOMY.LIGHTING.attributes.TIME,
  'time': TAXONOMY.LIGHTING.attributes.TIME,
  'mood': TAXONOMY.STYLE.id,
  'framing': TAXONOMY.CAMERA.attributes.FRAMING,
  'filmFormat': TAXONOMY.STYLE.attributes.FILM_STOCK,
  'cameraMove': TAXONOMY.CAMERA.attributes.MOVEMENT,
  'location': TAXONOMY.ENVIRONMENT.attributes.LOCATION,
  'subject': TAXONOMY.SUBJECT.id,
  'action': TAXONOMY.SUBJECT.attributes.ACTION,
  'camera': TAXONOMY.CAMERA.id,
  'lighting': TAXONOMY.LIGHTING.id,
  'technical': TAXONOMY.TECHNICAL.id,
  'style': TAXONOMY.STYLE.id,
  'environment': TAXONOMY.ENVIRONMENT.id,
};

// ============================================================================
// CATEGORY CAPS (Preserved for limiting span counts per category)
// ============================================================================

export const CATEGORY_CAPS: Record<string, number> = {
  [TAXONOMY.CAMERA.id]: 2,
  [TAXONOMY.CAMERA.attributes.MOVEMENT]: 2,
  [TAXONOMY.LIGHTING.id]: 2,
  [TAXONOMY.TECHNICAL.id]: 3,
  [TAXONOMY.STYLE.id]: 2,
  [TAXONOMY.STYLE.attributes.AESTHETIC]: 2,
  [TAXONOMY.ENVIRONMENT.id]: 2,
  [TAXONOMY.SUBJECT.id]: 3,
  [TAXONOMY.SUBJECT.attributes.ACTION]: 3,
};

// ============================================================================
// TYPES
// ============================================================================

export interface Span {
  text?: string;
  quote?: string;
  category?: string;
  role?: string;
  sourceText?: string;
}

export type ValidationReason =
  | 'missing_span'
  | 'empty_text'
  | 'invalid_taxonomy_id'
  | 'text_not_in_source'
  | null;

export interface ValidationResult {
  span: Span | null;
  pass: boolean;
  category?: string;
  reason: ValidationReason;
}

// ============================================================================
// MAIN VALIDATION FUNCTION (Structural Only)
// ============================================================================

/**
 * Validate a span using STRUCTURAL checks only
 * 
 * This function trusts the backend AI's semantic categorization.
 * It only verifies that:
 * - The span has valid structure (text, category)
 * - The category is a known taxonomy ID
 * - The text exists in the source (basic sanity check)
 */
export const validateSpan = (span: Span | null | undefined): ValidationResult => {
  if (!span) {
    return { span: span ?? null, pass: false, reason: 'missing_span' };
  }

  // Extract text from span (supports both 'text' and 'quote' fields)
  const text = (span.text || span.quote || '').trim();
  if (!text) {
    return { span, pass: false, reason: 'empty_text' };
  }

  let category = span.category || span.role;

  // Handle Legacy Mappings
  if (category && LEGACY_MAPPINGS[category]) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Validator] Legacy category "${category}" mapped to "${LEGACY_MAPPINGS[category]}"`);
    }
    category = LEGACY_MAPPINGS[category];
  }

  // Strict Taxonomy Check
  if (!category || !VALID_CATEGORIES.has(category)) {
    return {
      span,
      pass: false,
      reason: 'invalid_taxonomy_id',
      ...(typeof category === 'string' ? { category } : {}),
    };
  }

  // Verify text exists in source (if sourceText provided)
  // This is a basic sanity check, not a semantic validation
  if (span.sourceText && typeof span.sourceText === 'string') {
    if (!span.sourceText.includes(text)) {
      return { 
        span, 
        pass: false, 
        category, 
        reason: 'text_not_in_source' 
      };
    }
  }

  // All structural checks passed - trust the backend's categorization
  return { 
    span, 
    pass: true, 
    category, 
    reason: null 
  };
};
