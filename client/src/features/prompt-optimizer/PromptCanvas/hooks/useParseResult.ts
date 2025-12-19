/**
 * useParseResult Hook
 * 
 * Manages parse result state and conversion logic.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useEffect, useState } from 'react';
import { createCanonicalText } from '../../../../utils/canonicalText';
import { convertLabeledSpansToHighlights } from '@/features/span-highlighting';
import type { CanonicalText } from '../../../../utils/canonicalText';
import type { HighlightSpan } from '../../../span-highlighting/hooks/useHighlightRendering';
import type { ParseResult } from '../types';

export interface UseParseResultOptions {
  labeledSpans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  labeledMeta: Record<string, unknown> | null;
  labelingStatus: string;
  labelingError: Error | null;
  enableMLHighlighting: boolean;
  displayedPrompt: string | null;
}

export function useParseResult({
  labeledSpans,
  labeledMeta,
  labelingStatus,
  labelingError,
  enableMLHighlighting,
  displayedPrompt,
}: UseParseResultOptions): ParseResult {
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

    const highlights = convertLabeledSpansToHighlights({
      spans: labeledSpans,
      text: currentText,
      canonical,
    });

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
    labelingStatus,
    labelingError,
    enableMLHighlighting,
    displayedPrompt,
  ]);

  return parseResult;
}

