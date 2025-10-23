import { relocateQuote } from '../../../utils/textQuoteRelocator.js';

const ensureNumber = (value, fallback = -1) =>
  Number.isFinite(value) ? value : fallback;

export const applySuggestionToPrompt = ({
  prompt,
  suggestionText,
  highlight,
  spanMeta = {},
  metadata = {},
  offsets = {},
}) => {
  const workingPrompt = (prompt ?? '').normalize('NFC');
  const suggestionNfc = (suggestionText ?? '').normalize('NFC');
  const highlightText = (highlight ?? '').normalize('NFC');

  if (!workingPrompt || !suggestionNfc) {
    return { updatedPrompt: null };
  }

  let startIndex = ensureNumber(offsets.start, ensureNumber(spanMeta.start));
  let endIndex = ensureNumber(offsets.end, ensureNumber(spanMeta.end));

  const baseQuote = spanMeta.quote || highlightText || suggestionNfc;
  const replacementSource = baseQuote.normalize('NFC');
  const leftCtx = (spanMeta.leftCtx || metadata.leftCtx || '').normalize('NFC');
  const rightCtx = (spanMeta.rightCtx || metadata.rightCtx || '').normalize('NFC');

  const preferIndex = Number.isFinite(spanMeta.start) ? spanMeta.start : startIndex;

  const primaryRelocation = relocateQuote({
    text: workingPrompt,
    quote: replacementSource,
    leftCtx,
    rightCtx,
    preferIndex,
  });

  if (primaryRelocation) {
    startIndex = primaryRelocation.start;
    endIndex = primaryRelocation.end;
  }

  if (startIndex < 0 || endIndex <= startIndex) {
    const fallback = relocateQuote({
      text: workingPrompt,
      quote: replacementSource,
      leftCtx: (metadata.leftCtx || '').normalize('NFC'),
      rightCtx: (metadata.rightCtx || '').normalize('NFC'),
      preferIndex: preferIndex >= 0 ? preferIndex : undefined,
    });
    if (fallback) {
      startIndex = fallback.start;
      endIndex = fallback.end;
    }
  }

  if (startIndex < 0 || endIndex <= startIndex) {
    const fallbackStart = workingPrompt.indexOf(replacementSource);
    if (fallbackStart !== -1) {
      startIndex = fallbackStart;
      endIndex = fallbackStart + replacementSource.length;
    }
  }

  if (startIndex < 0 || endIndex <= startIndex || endIndex > workingPrompt.length) {
    return { updatedPrompt: null };
  }

  const currentSlice = workingPrompt.slice(startIndex, endIndex);
  const replacementTarget = currentSlice || replacementSource;

  const updatedPrompt = `${workingPrompt.slice(0, startIndex)}${suggestionNfc}${workingPrompt.slice(endIndex)}`;

  if (updatedPrompt === workingPrompt) {
    return { updatedPrompt: null };
  }

  return {
    updatedPrompt,
    replacementTarget,
    idempotencyKey: spanMeta.idempotencyKey || metadata.idempotencyKey || null,
  };
};

export default applySuggestionToPrompt;

