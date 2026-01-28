import { relocateQuote } from '@utils/textQuoteRelocator';
import { logger } from '@/services/LoggingService';
import { summarize } from '@/utils/logging';

const log = logger.child('applySuggestion');

const ensureNumber = (value: unknown, fallback = -1): number =>
  Number.isFinite(value) ? Number(value) : fallback;

export interface ApplySuggestionParams {
  prompt: string | null | undefined;
  suggestionText: string | null | undefined;
  highlight?: string | null;
  spanMeta?: {
    quote?: string;
    leftCtx?: string;
    rightCtx?: string;
    start?: number;
    idempotencyKey?: string | null;
    [key: string]: unknown;
  };
  metadata?: {
    leftCtx?: string;
    rightCtx?: string;
    idempotencyKey?: string | null;
    [key: string]: unknown;
  };
  offsets?: {
    start?: number;
    [key: string]: unknown;
  };
}

export interface ApplySuggestionResult {
  updatedPrompt: string | null;
  replacementTarget?: string;
  idempotencyKey?: string | null;
  matchStart?: number;
  matchEnd?: number;
}

export const applySuggestionToPrompt = ({
  prompt,
  suggestionText,
  highlight,
  spanMeta = {},
  metadata = {},
  offsets = {},
}: ApplySuggestionParams): ApplySuggestionResult => {
  // Normalize main prompt to ensure reliable indexing
  const workingPrompt = prompt ?? ''; 
  // We generally DO NOT want to NFC normalize the whole prompt arbitrarily if we are using indices,
  // but since we are searching, standardizing input is okay.
  
  const suggestionString = suggestionText ?? '';
  
  if (!workingPrompt || !suggestionString) {
    return { updatedPrompt: null };
  }

  // 1. Identify the text we are trying to replace (The "Anchor")
  // Priority: 
  // 1. The specific text associated with the span metadata (most accurate)
  // 2. The text passed as 'highlight' (from selection)
  // 3. The suggestion text itself (fallback for insertions)
  let quoteToFind = spanMeta.quote || highlight || suggestionString;
  
  // Clean the quote: trim it to avoid matching issues with edge whitespace
  quoteToFind = quoteToFind.trim();

  // 2. Gather Context
  const leftCtx = spanMeta.leftCtx || metadata.leftCtx || '';
  const rightCtx = spanMeta.rightCtx || metadata.rightCtx || '';
  
  // 3. Determine a hint for the location
  const preferIndex = ensureNumber(offsets.start, ensureNumber(spanMeta.start));

  // 4. Relocate!
  // This now uses the Token-Based Robust Matcher
  const match = relocateQuote({
    text: workingPrompt,
    quote: quoteToFind,
    leftCtx,
    rightCtx,
    preferIndex: preferIndex >= 0 ? preferIndex : null,
  });

  if (!match) {
    log.warn('Failed to locate anchor text', {
      operation: 'relocateQuote',
      quote: summarize(quoteToFind),
      quoteLength: quoteToFind.length,
      preferIndex,
    });
    return { updatedPrompt: null };
  }

  const { start, end } = match;

  // 5. Construct the new prompt
  // We use the INDICES from the match to slice the ORIGINAL string.
  // This preserves any weird whitespace surrounding the match that wasn't part of the match itself.
  const prefix = workingPrompt.slice(0, start);
  const suffix = workingPrompt.slice(end);
  
  const updatedPrompt = prefix + suggestionString + suffix;

  if (updatedPrompt === workingPrompt) {
    return { updatedPrompt: null };
  }

  return {
    updatedPrompt,
    replacementTarget: workingPrompt.slice(start, end),
    idempotencyKey: spanMeta.idempotencyKey || metadata.idempotencyKey || null,
    matchStart: start,
    matchEnd: end,
  };
};

export default applySuggestionToPrompt;
