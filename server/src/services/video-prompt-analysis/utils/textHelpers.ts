/**
 * Pure text utility functions
 */

/**
 * Count words in a string
 */
export function countWords(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Check if text appears to be a sentence
 */
export function isSentence(text: string | null | undefined, wordCount: number | null = null): boolean {
  if (!text) return false;
  
  const trimmed = text.trim();
  const count = wordCount ?? countWords(trimmed);
  
  return /[.!?]$/.test(trimmed) || count >= 12;
}

/**
 * Normalize text to lowercase
 */
export function normalizeText(text: string | null | undefined): string {
  return (text || '').toLowerCase();
}
