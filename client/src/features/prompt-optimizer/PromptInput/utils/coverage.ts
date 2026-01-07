export const computeCoverageScore = (text: string, words: readonly string[]): number => {
  const normalizedText = text.toLowerCase();
  if (!normalizedText.trim()) return 0;

  let matches = 0;
  for (const word of words) {
    const needle = word.toLowerCase();
    if (needle.includes(' ') || /[^a-z0-9]/i.test(needle)) {
      if (normalizedText.includes(needle)) matches += 1;
      continue;
    }
    if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(normalizedText)) {
      matches += 1;
    }
  }

  if (matches <= 0) return 0;
  const base = 0.35;
  const extra = Math.min(0.45, matches * 0.10);
  return Math.min(0.8, base + extra);
};
