const COMMON_CONTEXT_LENGTH = 80;

const computeContextScore = (text, index, quoteLength, leftCtx = '', rightCtx = '') => {
  let score = 0;

  if (leftCtx) {
    const availableLeft = text.slice(Math.max(0, index - COMMON_CONTEXT_LENGTH), index);
    const targetLeft = leftCtx.slice(-COMMON_CONTEXT_LENGTH);
    const maxCompare = Math.min(availableLeft.length, targetLeft.length);
    for (let i = 0; i < maxCompare; i += 1) {
      const charA = availableLeft[availableLeft.length - 1 - i];
      const charB = targetLeft[targetLeft.length - 1 - i];
      if (charA !== charB) break;
      score += 1;
    }
  }

  if (rightCtx) {
    const availableRight = text.slice(index + quoteLength, index + quoteLength + COMMON_CONTEXT_LENGTH);
    const targetRight = rightCtx.slice(0, COMMON_CONTEXT_LENGTH);
    const maxCompare = Math.min(availableRight.length, targetRight.length);
    for (let i = 0; i < maxCompare; i += 1) {
      const charA = availableRight[i];
      const charB = targetRight[i];
      if (charA !== charB) break;
      score += 1;
    }
  }

  return score;
};

export const relocateQuote = ({
  text,
  quote,
  leftCtx = '',
  rightCtx = '',
  preferIndex = null,
}) => {
  if (!text || !quote) return null;

  const matches = [];
  let index = text.indexOf(quote);
  while (index !== -1) {
    matches.push(index);
    index = text.indexOf(quote, index + 1);
  }

  if (!matches.length) {
    return null;
  }

  if (matches.length === 1) {
    const start = matches[0];
    return { start, end: start + quote.length };
  }

  let bestScore = -Infinity;
  let bestIndex = matches[0];

  matches.forEach((candidate) => {
    let score = computeContextScore(text, candidate, quote.length, leftCtx, rightCtx);
    if (typeof preferIndex === 'number') {
      const distance = Math.abs(candidate - preferIndex);
      // prefer closer matches when scores tie
      score -= distance * 0.01;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = candidate;
    }
  });

  return { start: bestIndex, end: bestIndex + quote.length };
};

