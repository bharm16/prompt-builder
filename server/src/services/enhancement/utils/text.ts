export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenize = (text: string): string[] =>
  normalizeText(text)
    .split(' ')
    .filter(Boolean);

export const jaccardSimilarity = (aTokens: string[], bTokens: string[]): number => {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  if (aSet.size === 0 && bSet.size === 0) return 1;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
};

export const collapseDuplicateWords = (text: string): string =>
  text.replace(/(\b\w+\b)(\s*,?\s*\1\b)+/gi, '$1');

export const cleanText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

export const replaceTerms = (text: string, terms: string[], replacement: string): string => {
  if (!terms.length) return text;
  let result = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(pattern, replacement);
  }
  return cleanText(result);
};
