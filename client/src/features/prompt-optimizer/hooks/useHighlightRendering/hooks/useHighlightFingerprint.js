/**
 * useHighlightFingerprint Hook
 * 
 * Creates a unique fingerprint for the current highlight state.
 * Used to determine if highlights need to be re-rendered.
 */

import { useMemo } from 'react';
import { createHighlightSignature } from '../../useSpanLabeling.js';

/**
 * Creates a unique fingerprint for the current highlight state
 * Used to determine if highlights need to be re-rendered
 *
 * @param {boolean} enabled - Whether highlighting is enabled
 * @param {Object} parseResult - Parse result containing text and spans
 * @returns {string|null} Fingerprint string or null if disabled
 */
export function useHighlightFingerprint(enabled, parseResult) {
  return useMemo(() => {
    if (!enabled) {
      return null;
    }

    const text = parseResult?.displayText ?? '';
    const spans = Array.isArray(parseResult?.spans) ? parseResult.spans : [];
    const textSignature = createHighlightSignature(text ?? '');

    if (!spans.length) {
      return `empty::${textSignature}`;
    }

    const spanSignature = spans
      .map((span) =>
        [span.id ?? '', span.displayStart ?? span.start, span.displayEnd ?? span.end, span.category ?? ''].join(':')
      )
      .join('|');

    return `${textSignature}::${spanSignature}`;
  }, [enabled, parseResult?.displayText, parseResult?.spans]);
}

