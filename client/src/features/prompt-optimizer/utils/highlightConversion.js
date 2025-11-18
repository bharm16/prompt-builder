/**
 * Highlight Conversion Utility
 * Converts labeled spans from the LLM into highlight data structures
 */

const LLM_PARSER_VERSION = 'llm-v1';
const CONTEXT_WINDOW_CHARS = 20;

/**
 * Maps LLM role names to category identifiers
 */
const ROLE_TO_CATEGORY = {
  Subject: 'subject',
  Appearance: 'appearance',
  Wardrobe: 'wardrobe',
  Movement: 'movement',
  Environment: 'environment',
  Lighting: 'lighting',
  Camera: 'camera',
  Framing: 'framing',
  Specs: 'specs',
  Style: 'style',
  Quality: 'quality',
};

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

  return spans
    .map((span, index) => {
      if (!span || typeof span !== 'object') {
        return null;
      }

      const role = typeof span.role === 'string' ? span.role : 'Quality';
      const category = ROLE_TO_CATEGORY[role] || 'quality';

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
};
