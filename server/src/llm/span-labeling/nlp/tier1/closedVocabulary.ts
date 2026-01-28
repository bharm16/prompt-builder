import AhoCorasick from 'ahocorasick';
import { VOCAB } from '../vocab';
import { extractPatternSpans } from './patterns';
import type { NlpSpan, PatternInfo } from '../types';

function buildAhoCorasickAutomaton(): {
  ac: AhoCorasick;
  patternToTaxonomy: Map<string, PatternInfo>;
} {
  const patterns: string[] = [];
  const patternToTaxonomy = new Map<string, PatternInfo>();

  for (const [taxonomyId, terms] of Object.entries(VOCAB)) {
    for (const term of terms) {
      const lowerTerm = term.toLowerCase();
      patterns.push(lowerTerm);
      patternToTaxonomy.set(lowerTerm, { taxonomyId, originalTerm: term });
    }
  }

  const ac = new AhoCorasick(patterns);
  return { ac, patternToTaxonomy };
}

const { ac: ahoCorasick, patternToTaxonomy } = buildAhoCorasickAutomaton();

const WORD_CHAR_REGEX = /[A-Za-z0-9]/;

function isWordChar(value: string | undefined): boolean {
  return Boolean(value && WORD_CHAR_REGEX.test(value));
}

function hasSafeWordBoundaries(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  const startChar = text[start];
  const endChar = text[end - 1];

  if (isWordChar(startChar) && isWordChar(before)) return false;
  if (isWordChar(endChar) && isWordChar(after)) return false;
  return true;
}

export function extractClosedVocabulary(text: string): NlpSpan[] {
  if (!text || typeof text !== 'string') return [];

  const lowerText = text.toLowerCase();
  const results = ahoCorasick.search(lowerText);
  const spans: NlpSpan[] = [];

  for (const [endIndex, patterns] of results) {
    for (const pattern of patterns) {
      const info = patternToTaxonomy.get(pattern);
      if (!info) continue;

      const start = endIndex - pattern.length + 1;
      const end = endIndex + 1;
      const matchedText = text.substring(start, end);

      if (!hasSafeWordBoundaries(text, start, end)) {
        continue;
      }

      spans.push({
        text: matchedText,
        role: info.taxonomyId,
        confidence: 1.0,
        start,
        end,
        source: 'aho-corasick'
      });
    }
  }

  spans.push(...extractPatternSpans(text));

  return spans;
}
