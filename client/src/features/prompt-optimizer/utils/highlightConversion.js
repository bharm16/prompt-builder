/**
 * Highlight Conversion Utility
 * Converts labeled spans from the LLM into highlight data structures
 * Now uses unified taxonomy system with namespaced IDs
 */

import { VALID_CATEGORIES, TAXONOMY } from '@shared/taxonomy.js';

const LLM_PARSER_VERSION = 'llm-v2-taxonomy';
const CONTEXT_WINDOW_CHARS = 20;

/**
 * Legacy mapping for backward compatibility (deprecated)
 * Will be removed once all cached responses are using taxonomy IDs
 */
const LEGACY_ROLE_TO_CATEGORY = {
  Subject: 'subject',
  Appearance: 'subject.appearance',
  Wardrobe: 'subject.wardrobe',
  Movement: 'action.movement',
  Environment: 'environment',
  Lighting: 'lighting',
  Camera: 'camera',
  Framing: 'shot.type',
  Specs: 'technical',
  Style: 'style',
  Quality: 'style.aesthetic',
};

/**
 * Normalize a role to a valid taxonomy ID
 * @param {string} role - Role from LLM response
 * @returns {string} Valid taxonomy ID
 */
function normalizeRole(role) {
  if (!role || typeof role !== 'string') {
    return TAXONOMY.SUBJECT.id;
  }

  // If it's already a valid taxonomy ID, use it directly
  if (VALID_CATEGORIES.has(role)) {
    return role;
  }

  // Check for legacy capitalized format
  if (LEGACY_ROLE_TO_CATEGORY[role]) {
    if (import.meta.env.DEV) {
      console.warn(`[highlightConversion] Legacy role "${role}" detected, mapping to "${LEGACY_ROLE_TO_CATEGORY[role]}"`);
    }
    return LEGACY_ROLE_TO_CATEGORY[role];
  }

  // Fallback for unknown roles
  console.warn(`[highlightConversion] Unknown role "${role}", defaulting to subject`);
  return TAXONOMY.SUBJECT.id;
}

/**
 * Helper to merge adjacent spans that were split by newlines/whitespace
 * @param {Array} highlights - Sorted array of highlight objects
 * @param {string} fullText - The full text being highlighted
 * @returns {Array} Array of merged highlight objects
 */
function mergeFragmentedSpans(highlights, fullText) {
  if (highlights.length < 2) return highlights;

  const merged = [];
  let current = highlights[0];

  for (let i = 1; i < highlights.length; i++) {
    const next = highlights[i];

    // 1. Must be same category/role
    const sameCategory = current.category === next.category;

    // 2. Must be adjacent (only whitespace/newlines in between)
    // We assume highlights are already sorted by start
    const gapText = fullText.slice(current.end, next.start);
    const isAdjacent = !gapText.trim(); // True if gap is empty or just whitespace

    if (sameCategory && isAdjacent) {
      // MERGE THEM
      // Extend current span to include the next one
      current.end = next.end;
      current.displayEnd = next.end;
      current.quote = fullText.slice(current.start, current.end);
      current.displayQuote = current.quote;

      // Inherit the right context from the later span
      current.rightCtx = next.rightCtx;
      current.displayRightCtx = next.displayRightCtx;
      current.endGrapheme = next.endGrapheme;

      // Combine IDs for debugging (optional)
      current.id = `${current.id}_merged`;
    } else {
      // No merge, push current and move to next
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Converts labeled spans from the LLM into highlight objects
 * @param {Object} params
 * @param {Array} params.spans - Array of span objects from the LLM
 * @param {string} params.text - The full text being highlighted
 * @param {Object} params.canonical - Canonical text representation with grapheme mapping
 * @returns {Array} Array of highlight objects
 */
export const convertLabeledSpansToHighlights = ({ spans, text, canonical }) => {
  if (!Array.isArray(spans) || !text) {
    return [];
  }

  // 1. Convert raw LLM spans to highlight objects
  const rawHighlights = spans
    .map((span, index) => {
      if (!span || typeof span !== 'object') {
        return null;
      }

      // Normalize role to valid taxonomy ID (handles both new and legacy formats)
      const role = typeof span.role === 'string' ? span.role : TAXONOMY.SUBJECT.id;
      const category = normalizeRole(role);

      const start = Number(span.start);
      const end = Number(span.end);

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
      }

      const clampedStart = Math.max(0, Math.min(text.length, start));
      const clampedEnd = Math.max(clampedStart, Math.min(text.length, end));
      if (clampedEnd <= clampedStart) {
        return null;
      }

      const slice = text.slice(clampedStart, clampedEnd);
      if (!slice) {
        return null;
      }

      const leftCtx = text.slice(
        Math.max(0, clampedStart - CONTEXT_WINDOW_CHARS),
        clampedStart
      );
      const rightCtx = text.slice(
        clampedEnd,
        Math.min(text.length, clampedEnd + CONTEXT_WINDOW_CHARS)
      );

      const startGrapheme = canonical?.graphemeIndexForCodeUnit
        ? canonical.graphemeIndexForCodeUnit(clampedStart)
        : undefined;
      const endGrapheme = canonical?.graphemeIndexForCodeUnit
        ? canonical.graphemeIndexForCodeUnit(clampedEnd)
        : undefined;

      return {
        id: span.id ?? `llm_${category}_${index}_${clampedStart}_${clampedEnd}`,
        category,
        role,
        start: clampedStart,
        end: clampedEnd,
        displayStart: clampedStart,
        displayEnd: clampedEnd,
        quote: slice,
        displayQuote: slice,
        leftCtx,
        rightCtx,
        displayLeftCtx: leftCtx,
        displayRightCtx: rightCtx,
        source: 'llm',
        confidence:
          typeof span.confidence === 'number' ? span.confidence : undefined,
        validatorPass: true,
        startGrapheme,
        endGrapheme,
        version: LLM_PARSER_VERSION,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.start === b.start) {
        return a.end - b.end;
      }
      return a.start - b.start;
    });

  // 2. Merge fragmented spans before returning
  return mergeFragmentedSpans(rawHighlights, text);
};
