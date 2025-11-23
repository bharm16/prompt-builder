import { ROLE_SET } from '../config/roles.js';
import { wordCount } from '../utils/textUtils.js';
import { normalizeSpan } from '../processing/SpanNormalizer.js';
import { deduplicateSpans } from '../processing/SpanDeduplicator.js';
import { resolveOverlaps } from '../processing/OverlapResolver.js';
import { filterByConfidence } from '../processing/ConfidenceFilter.js';
import { truncateToMaxSpans } from '../processing/SpanTruncator.js';

/**
 * Lightly sanitize span text before alignment to improve hit rate on
 * minor formatting differences (quotes, markdown emphasis, extra spaces).
 */
function normalizeSpanTextForLookup(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[`"'“”]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comprehensive span validation and processing
 *
 * This is the core validation orchestrator that:
 * 1. Validates individual spans (text, indices, role)
 * 2. Auto-corrects indices using position cache
 * 3. Applies processing pipeline (dedupe, overlap, filter, truncate)
 * 4. Supports strict and lenient validation modes
 */

/**
 * Validate and process spans with auto-correction and filtering
 *
 * Phase 1: Individual span validation & auto-correction
 * Phase 2: Sorting by position
 * Phase 3: Deduplication
 * Phase 4: Overlap resolution
 * Phase 5: Confidence filtering
 * Phase 6: Truncation to max spans
 *
 * @param {Object} params
 * @param {Array} params.spans - Raw spans from LLM
 * @param {Object} params.meta - Metadata from LLM response
 * @param {string} params.text - Source text
 * @param {Object} params.policy - Validation policy
 * @param {Object} params.options - Processing options
 * @param {number} params.attempt - Validation attempt (1 = strict, 2 = lenient)
 * @param {SubstringPositionCache} params.cache - Position cache for span correction
 * @returns {Object} {ok: boolean, errors: Array, result: {spans: Array, meta: Object}}
 */
export function validateSpans({
  spans,
  meta,
  text,
  policy,
  options,
  attempt = 1,
  cache,
  isAdversarial = false,
}) {
  const errors = [];
  const validationNotes = [];
  const autoFixNotes = [];
  const sanitized = [];
  const lenient = attempt > 1;

  // Phase 1: Validate and correct individual spans
  spans.forEach((originalSpan, index) => {
    const label = `span[${index}]`;
    const span = originalSpan ? { ...originalSpan } : originalSpan;

    // Check for text field
    if (typeof span.text !== 'string' || span.text.length === 0) {
      if (!lenient) errors.push(`${label} missing text`);
      else validationNotes.push(`${label} dropped: missing text`);
      return;
    }

    // Find correct indices in source text
    const preferredStart = Number.isInteger(span.start) ? span.start : 0;
    let corrected = cache.findBestMatch(text, span.text, preferredStart);

    // Retry with normalized text (remove quotes/markdown, collapse spaces) if no direct hit
    if (!corrected) {
      const cleanedText = normalizeSpanTextForLookup(span.text);
      if (cleanedText && cleanedText !== span.text) {
        corrected = cache.findBestMatch(text, cleanedText, preferredStart);
      }
    }

    // Last-resort case-insensitive search to catch minor casing mismatches
    if (!corrected) {
      const loweredSource = text.toLowerCase();
      const loweredTarget = normalizeSpanTextForLookup(span.text).toLowerCase();
      const idx = loweredTarget ? loweredSource.indexOf(loweredTarget) : -1;
      if (idx !== -1) {
        corrected = { start: idx, end: idx + loweredTarget.length };
      }
    }

    if (!corrected) {
      if (!lenient) {
        errors.push(`${label} text "${span.text}" not found in source`);
      } else {
        validationNotes.push(`${label} dropped: text not found in source`);
      }
      return;
    }

    // Apply auto-corrected indices
    if (span.start !== corrected.start || span.end !== corrected.end) {
      autoFixNotes.push(
        `${label} indices auto-adjusted from ${span.start}-${span.end} to ${corrected.start}-${corrected.end}`
      );
    }

    // Create corrected span (immutable)
    const correctedSpan = {
      ...span,
      start: corrected.start,
      end: corrected.end,
    };

    // Normalize role and confidence (includes ID generation)
    const normalized = normalizeSpan(correctedSpan, text, lenient);
    if (!normalized || !normalized.role) {
      if (!lenient) {
        errors.push(
          `${label} role "${span.role}" is not in the allowed set (${Array.from(ROLE_SET).join(', ')})`
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

    // Check word limit for non-exempt spans only
    if (
      !isExemptCategory &&
      policy.nonTechnicalWordLimit > 0 &&
      wordCount(normalized.text) > policy.nonTechnicalWordLimit
    ) {
      if (!lenient) {
        errors.push(
          `${label} exceeds non-technical word limit (${policy.nonTechnicalWordLimit} words)`
        );
      } else {
        validationNotes.push(`${label} dropped: exceeds non-technical word limit`);
      }
      return;
    }

    sanitized.push(normalized);
  });

  // Phase 2: Sort by position
  sanitized.sort((a, b) => {
    if (a.start === b.start) return a.end - b.end;
    return a.start - b.start;
  });

  // Phase 3: Deduplicate
  const { spans: deduplicated, notes: dedupeNotes } = deduplicateSpans(sanitized);

  // Phase 4: Resolve overlaps
  const { spans: resolved, notes: overlapNotes } = resolveOverlaps(
    deduplicated,
    policy.allowOverlap
  );

  // Phase 5: Filter by confidence
  const { spans: confidenceFiltered, notes: confidenceNotes } = filterByConfidence(
    resolved,
    options.minConfidence
  );

  // Phase 6: Truncate to max spans
  const { spans: finalSpans, notes: truncationNotes } = truncateToMaxSpans(
    confidenceFiltered,
    options.maxSpans
  );

  // Combine all notes
  const combinedNotes = [
    ...(Array.isArray(meta?.notes) ? meta.notes : []),
    ...(typeof meta?.notes === 'string' && meta.notes ? [meta.notes] : []),
    ...(isAdversarial ? ['input flagged as adversarial'] : []),
    ...validationNotes,
    ...autoFixNotes,
    ...dedupeNotes,
    ...overlapNotes,
    ...confidenceNotes,
    ...truncationNotes,
  ].filter(Boolean);

  return {
    ok: errors.length === 0,
    errors,
    result: {
      spans: finalSpans,
      meta: {
        version:
          typeof meta?.version === 'string' && meta.version.trim()
            ? meta.version.trim()
            : options.templateVersion,
        notes: combinedNotes.join(' | '),
      },
      isAdversarial: Boolean(isAdversarial),
    },
  };
}
