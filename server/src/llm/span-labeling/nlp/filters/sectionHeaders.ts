import { SECTION_HEADER_WORDS } from '../../config/SemanticConfig.js';
import type { NlpSpan } from '../types';

function isSectionHeader(text: string, span: NlpSpan): boolean {
  const spanText = span.text.trim();
  const spanLower = spanText.toLowerCase();

  const wordCount = spanText.split(/\s+/).length;
  if (wordCount > 2) return false;

  if (!SECTION_HEADER_WORDS.has(spanLower)) return false;

  const contextBefore = text.slice(Math.max(0, span.start - 10), span.start);
  const contextAfter = text.slice(span.end, Math.min(text.length, span.end + 5));

  if (/(?:^|\n)\s*(?:#{1,3}\s*|\*\*\s*)$/.test(contextBefore)) {
    return true;
  }

  if (/^\s*\**\s*:/.test(contextAfter)) {
    return true;
  }

  if (/(?:^|\n)\s*$/.test(contextBefore) && /^\s*:/.test(contextAfter)) {
    return true;
  }

  return false;
}

export function filterSectionHeaders(text: string, spans: NlpSpan[]): NlpSpan[] {
  return spans.filter((span) => !isSectionHeader(text, span));
}
