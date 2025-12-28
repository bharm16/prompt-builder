/**
 * useParseResult Hook
 * 
 * Manages parse result state and conversion logic.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useEffect, useState } from 'react';
import { logger } from '@/services/LoggingService';
import { createCanonicalText } from '@utils/canonicalText';
import { convertLabeledSpansToHighlights, createHighlightSignature } from '@features/span-highlighting';
import type { CanonicalText } from '@utils/canonicalText';
import type { HighlightSpan } from '@features/span-highlighting/hooks/useHighlightRendering';
import type { ParseResult } from '../types';

export interface UseParseResultOptions {
  labeledSpans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  labeledMeta: Record<string, unknown> | null;
  labelingSignature?: string | null;
  labelingStatus: string;
  labelingError: Error | null;
  enableMLHighlighting: boolean;
  displayedPrompt: string | null;
}

export function useParseResult({
  labeledSpans,
  labeledMeta,
  labelingSignature,
  labelingStatus,
  labelingError,
  enableMLHighlighting,
  displayedPrompt,
}: UseParseResultOptions): ParseResult {
  const log = logger.child('ParseResult');
  const [parseResult, setParseResult] = useState<ParseResult>(() => {
    const canonical = createCanonicalText(displayedPrompt ?? '') as CanonicalText;
    return {
      canonical,
      spans: [] as HighlightSpan[],
      meta: null,
      status: 'idle',
      error: null,
      displayText: displayedPrompt ?? '',
    };
  });

  useEffect(() => {
    const canonical = createCanonicalText(displayedPrompt ?? '') as CanonicalText;
    const currentText = displayedPrompt ?? '';
    const currentSignature = createHighlightSignature(currentText);
    const signatureMatches =
      !labelingSignature || labelingSignature === currentSignature;

    if (!enableMLHighlighting || !currentText.trim()) {
      setParseResult({
        canonical,
        spans: [] as HighlightSpan[],
        meta: labeledMeta,
        status: labelingStatus as ParseResult['status'],
        error: labelingError,
        displayText: currentText,
      });
      return;
    }

    if (!signatureMatches) {
      if (enableMLHighlighting && labeledSpans.length > 0) {
        log.debug('Span signature mismatch; dropping labeled spans', {
          labeledSpanCount: labeledSpans.length,
          labelingStatus,
          textLength: currentText.length,
          labelingSignature: labelingSignature ? labelingSignature.slice(0, 12) : null,
          currentSignature: currentSignature.slice(0, 12),
        });
      }
      setParseResult({
        canonical,
        spans: [] as HighlightSpan[],
        meta: null,
        status: labelingStatus as ParseResult['status'],
        error: labelingError,
        displayText: currentText,
      });
      return;
    }

    const highlights = convertLabeledSpansToHighlights({
      spans: labeledSpans,
      text: currentText,
      canonical,
    });

    const highlightCount = highlights.length;

    if (enableMLHighlighting && labeledSpans.length > 1 && highlightCount <= 1) {
      log.debug('Span conversion produced minimal highlights', {
        labeledSpanCount: labeledSpans.length,
        highlightCount,
        labelingStatus,
        textLength: currentText.length,
        signature: currentSignature.slice(0, 12),
        spanSamples: labeledSpans.slice(0, 3).map((span) => ({
          start: span.start,
          end: span.end,
          role: span.category ?? (span as { role?: string }).role ?? null,
        })),
      });
    }

    setParseResult({
      canonical,
      spans: highlights as HighlightSpan[],
      meta: labeledMeta,
      status: labelingStatus as ParseResult['status'],
      error: labelingError,
      displayText: currentText,
    });
  }, [
    labeledSpans,
    labeledMeta,
    labelingSignature,
    labelingStatus,
    labelingError,
    enableMLHighlighting,
    displayedPrompt,
  ]);

  return parseResult;
}
