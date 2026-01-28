export const normalizeText = (value: string): string =>
  value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

export const countWords = (value: string): number =>
  normalizeText(value).split(/\s+/).filter(Boolean).length;

export const extractMainVideoPrompt = (optimized: string): string => {
  const text = typeof optimized === 'string' ? optimized.trim() : '';
  if (!text) return '';

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.prompt === 'string' && parsed.prompt.trim()) {
        return parsed.prompt.trim();
      }
    } catch {
      // Fall through to section parsing.
    }
  }

  const techHeader = /\n\s*\*\*TECHNICAL SPECS\*\*\s*\n/i;
  const match = techHeader.exec(text);
  if (match && typeof match.index === 'number' && match.index > 0) {
    return text.slice(0, match.index).trim();
  }

  return text;
};
