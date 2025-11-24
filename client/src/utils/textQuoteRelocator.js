// client/src/utils/textQuoteRelocator.js

/**
 * Tokenizes text into words/symbols, ignoring whitespace differences.
 */
const tokenize = (text) => {
  return text.toLowerCase().match(/\S+/g) || [];
};

/**
 * Robust context scoring that matches strictly on tokens (words) rather than characters.
 * This makes it immune to whitespace variance (spaces vs tabs vs newlines).
 */
const computeTokenScore = (
  fullText,
  matchIndex,
  matchLength,
  leftCtx = '',
  rightCtx = ''
) => {
  let score = 0;
  const WINDOW_SIZE = 20; // Look at up to 20 words of context

  // 1. Score Left Context (Backwards from match)
  if (leftCtx) {
    // Extract words immediately preceding the match
    const textBefore = fullText.slice(0, matchIndex);
    const textTokens = tokenize(textBefore).slice(-WINDOW_SIZE); // Last N words
    const ctxTokens = tokenize(leftCtx).slice(-WINDOW_SIZE); // Last N words of context

    // Count matching tokens in reverse order (nearest to match is most important)
    const limit = Math.min(textTokens.length, ctxTokens.length);
    for (let i = 0; i < limit; i++) {
      const t1 = textTokens[textTokens.length - 1 - i];
      const t2 = ctxTokens[ctxTokens.length - 1 - i];
      if (t1 === t2) {
        score += 2; // Weight close matches higher
      } else {
        // Allow one mismatch/skip in the chain before breaking? 
        // For now, strict token sequence, but robust to whitespace.
        break;
      }
    }
  }

  // 2. Score Right Context (Forwards from match)
  if (rightCtx) {
    const textAfter = fullText.slice(matchIndex + matchLength);
    const textTokens = tokenize(textAfter).slice(0, WINDOW_SIZE);
    const ctxTokens = tokenize(rightCtx).slice(0, WINDOW_SIZE);

    const limit = Math.min(textTokens.length, ctxTokens.length);
    for (let i = 0; i < limit; i++) {
      if (textTokens[i] === ctxTokens[i]) {
        score += 2;
      } else {
        break;
      }
    }
  }

  return score;
};

/**
 * Finds all occurrences of the quote, handling whitespace collapsing.
 * Returns array of { start, end }
 */
const findCandidates = (text, quote) => {
  if (!text || !quote) return [];
  
  const candidates = [];
  
  // 1. Try Exact Match first (fastest)
  let idx = text.indexOf(quote);
  while (idx !== -1) {
    candidates.push({ start: idx, end: idx + quote.length, exact: true });
    idx = text.indexOf(quote, idx + 1);
  }

  // 2. If no exact matches, try Fuzzy/Normalized Match
  // This handles case where user typed extra space in the span
  if (candidates.length === 0) {
    // Escape regex characters
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create a regex that allows variable whitespace between words
    // e.g. "hello world" -> "hello\s+world"
    const parts = quote.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const pattern = parts.map(escapeRegExp).join('\\s+');
      const regex = new RegExp(pattern, 'g');
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        candidates.push({ 
          start: match.index, 
          end: match.index + match[0].length,
          exact: false 
        });
      }
    }
  }

  return candidates;
};

export const relocateQuote = ({
  text,
  quote,
  leftCtx = '',
  rightCtx = '',
  preferIndex = null,
}) => {
  if (!text || !quote) return null;

  // 1. Find all possible locations of the quote (exact or fuzzy)
  const matches = findCandidates(text, quote);

  if (!matches.length) {
    // CRITICAL FALLBACK: If the quote itself was edited by the user,
    // we might try to find the "hole" between leftCtx and rightCtx.
    // (Omitting for safety unless requested, strictly returning null is safer than guessing wrong)
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  // 2. Score all candidates
  let bestScore = -Infinity;
  let bestMatch = matches[0];

  matches.forEach((match) => {
    let score = computeTokenScore(text, match.start, match.end - match.start, leftCtx, rightCtx);

    // 3. Distance Penalty (Heuristic)
    // If we have a preferred index (old position), prefer candidates close to it.
    if (typeof preferIndex === 'number') {
      const distance = Math.abs(match.start - preferIndex);
      // Determine penalty weight: e.g., -1 point for every 1000 chars of distance
      // This breaks ties in context score.
      score -= (distance / 1000); 
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = match;
    }
  });

  return bestMatch;
};
