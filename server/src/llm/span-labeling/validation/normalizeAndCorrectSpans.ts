import { ROLE_SET } from '../config/roles.js';
import { getParentCategory } from '#shared/taxonomy.ts';
import { wordCount } from '../utils/textUtils.js';
import { normalizeSpan } from '../processing/SpanNormalizer.js';
import type { SubstringPositionCache } from '../cache/SubstringPositionCache.js';
import type { LLMSpan } from '../types.js';

/**
 * Lightly sanitize span text before alignment to improve hit rate on
 * minor formatting differences (quotes, markdown emphasis, extra spaces).
 */
function normalizeSpanTextForLookup(value: string): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[`"'""]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ValidationPolicy {
  nonTechnicalWordLimit?: number;
  allowOverlap?: boolean;
}

export interface NormalizeAndCorrectResult {
  sanitized: Array<LLMSpan & { id?: string }>;
  errors: string[];
  notes: string[];
}

/**
 * Phase 1: Normalize and correct individual spans
 *
 * Handles:
 * - Text field validation
 * - Index auto-correction using position cache
 * - Role normalization and validation
 * - Word count checks for non-technical spans
 *
 * @param spans - Raw spans from LLM
 * @param text - Source text
 * @param policy - Validation policy
 * @param cache - Position cache for span correction
 * @param lenient - If true, drops invalid spans instead of erroring
 * @returns Normalized spans with errors and notes
 */
export function normalizeAndCorrectSpans(
  spans: unknown[],
  text: string,
  policy: ValidationPolicy,
  cache: SubstringPositionCache,
  lenient: boolean
): NormalizeAndCorrectResult {
  const errors: string[] = [];
  const validationNotes: string[] = [];
  const autoFixNotes: string[] = [];
  const sanitized: Array<LLMSpan & { id?: string }> = [];

  spans.forEach((originalSpan, index) => {
    const label = `span[${index}]`;
    const span = originalSpan ? { ...(originalSpan as Record<string, unknown>) } : originalSpan;

    if (!span || typeof span !== 'object') {
      if (!lenient) errors.push(`${label} invalid span object`);
      else validationNotes.push(`${label} dropped: invalid span object`);
      return;
    }

    const spanObj = span as Record<string, unknown>;

    // Check for text field
    if (typeof spanObj.text !== 'string' || spanObj.text.length === 0) {
      if (!lenient) errors.push(`${label} missing text`);
      else validationNotes.push(`${label} dropped: missing text`);
      return;
    }

    // Find correct indices in source text
    const preferredStart = Number.isInteger(spanObj.start) ? (spanObj.start as number) : 0;
    let corrected = cache.findBestMatch(text, spanObj.text, preferredStart);

    // Retry with normalized text (remove quotes/markdown, collapse spaces) if no direct hit
    if (!corrected) {
      const cleanedText = normalizeSpanTextForLookup(spanObj.text);
      if (cleanedText && cleanedText !== spanObj.text) {
        corrected = cache.findBestMatch(text, cleanedText, preferredStart);
      }
    }

    // Last-resort case-insensitive search to catch minor casing mismatches
    if (!corrected) {
      const loweredSource = text.toLowerCase();
      const loweredTarget = normalizeSpanTextForLookup(spanObj.text).toLowerCase();
      const idx = loweredTarget ? loweredSource.indexOf(loweredTarget) : -1;
      if (idx !== -1) {
        corrected = { start: idx, end: idx + loweredTarget.length };
      }
    }

    if (!corrected) {
      if (!lenient) {
        errors.push(`${label} text "${spanObj.text}" not found in source`);
      } else {
        validationNotes.push(`${label} dropped: text not found in source`);
      }
      return;
    }

    // Apply auto-corrected indices
    if (spanObj.start !== corrected.start || spanObj.end !== corrected.end) {
      autoFixNotes.push(
        `${label} indices auto-adjusted from ${spanObj.start}-${spanObj.end} to ${corrected.start}-${corrected.end}`
      );
    }

    // Create corrected span (immutable)
    const correctedSpan = {
      ...spanObj,
      start: corrected.start,
      end: corrected.end,
    } as LLMSpan;

    // Normalize role and confidence (includes ID generation)
    const normalized = normalizeSpan(correctedSpan, text, lenient);
    if (!normalized || !normalized.role) {
      if (!lenient) {
        errors.push(
          `${label} role "${spanObj.role}" is not in the allowed set (${Array.from(ROLE_SET).join(', ')})`
        );
      }
      return;
    }

    // Check if role is a technical category (should be exempt from word limit)
    const isExemptCategory = 
      normalized.role.startsWith('technical') || 
      normalized.role.startsWith('style') || 
      normalized.role.startsWith('camera') ||
      normalized.role.startsWith('audio') ||
      normalized.role.startsWith('lighting') ||
      normalized.role === 'Specs' || // Keep legacy for safety
      normalized.role === 'Style';

    const parentCategory = getParentCategory(normalized.role) || normalized.role;
    const adjustedLimit =
      parentCategory === 'action' || parentCategory === 'environment'
        ? Math.max(policy.nonTechnicalWordLimit ?? 0, 12)
        : policy.nonTechnicalWordLimit ?? 0;

    // Check word limit for non-exempt spans only
    if (
      !isExemptCategory &&
      adjustedLimit > 0 &&
      wordCount(normalized.text) > adjustedLimit
    ) {
      if (!lenient) {
        errors.push(
          `${label} exceeds non-technical word limit (${adjustedLimit} words)`
        );
      } else {
        validationNotes.push(`${label} dropped: exceeds non-technical word limit`);
      }
      return;
    }

    sanitized.push(normalized);
  });

  return {
    sanitized,
    errors,
    notes: [...validationNotes, ...autoFixNotes],
  };
}











