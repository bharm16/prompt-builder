/**
 * useHighlightFingerprint Hook
 *
 * Creates a unique fingerprint for the current highlight state.
 * Used to determine if highlights need to be re-rendered.
 */

import { useMemo } from 'react';
import { createHighlightSignature } from './useSpanLabeling.js';

interface Span {
  id?: string;
  displayStart?: number;
  start?: number;
  displayEnd?: number;
  end?: number;
  category?: string;
  [key: string]: unknown;
}

interface ParseResult {
  displayText?: string;
  spans?: Span[];
  [key: string]: unknown;
}

/**
 * Creates a unique fingerprint for the current highlight state
 * Used to determine if highlights need to be re-rendered
 */
export function useHighlightFingerprint(
  enabled: boolean,
  parseResult: ParseResult | null | undefined
): string | null {
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
        [
          span.id ?? '',
          span.displayStart ?? span.start ?? 0,
          span.displayEnd ?? span.end ?? 0,
          span.category ?? '',
        ].join(':')
      )
      .join('|');

    return `${textSignature}::${spanSignature}`;
  }, [enabled, parseResult?.displayText, parseResult?.spans]);
}

