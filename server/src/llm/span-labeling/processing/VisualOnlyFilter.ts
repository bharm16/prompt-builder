import type { SpanLike } from '../types.js';
import { META_MARKERS, ALTERNATIVE_SECTION_REGEX, STYLE_REFERENCE_CONTEXT_REGEX } from '../config/SemanticConfig.js';
import { TAXONOMY } from '#shared/taxonomy.ts';

interface FilterResult {
  spans: SpanLike[];
  notes: string[];
}

// Generate a set of all taxonomy labels (e.g. "lighting", "subject", "action")
// for detecting meta-references like "The Lighting" or "Main Action".
const TAXONOMY_LABELS = new Set<string>();
for (const category of Object.values(TAXONOMY)) {
  TAXONOMY_LABELS.add(category.label.toLowerCase());
  // Add the ID itself as a fallback label (e.g. "lighting", "camera")
  TAXONOMY_LABELS.add(category.id.toLowerCase());
  if (category.attributes) {
    for (const attrKey of Object.keys(category.attributes)) {
      // Add attribute keys if they are distinct words (e.g. "movement")
      TAXONOMY_LABELS.add(attrKey.toLowerCase());
    }
  }
}

function findAlternativeSectionStart(text: string): number | null {
  ALTERNATIVE_SECTION_REGEX.lastIndex = 0;
  const match = ALTERNATIVE_SECTION_REGEX.exec(text);
  return match ? match.index : null;
}

function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isProperNoun(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.some((token) => /\d/.test(token))) return false;
  return tokens.some((token) => /^[A-Z][a-z]/.test(token));
}

function isStyleReferenceSpan(spanText: string, span: SpanLike, text: string): boolean {
  if (!spanText) return false;
  if (!isProperNoun(spanText)) return false;

  const role = typeof span.role === 'string' ? span.role : '';
  if (role.startsWith('style.filmStock') || role.startsWith('technical')) {
    return false;
  }

  const start = typeof span.start === 'number' ? span.start : 0;
  const end = typeof span.end === 'number' ? span.end : start + spanText.length;
  const contextStart = Math.max(0, start - 100);
  const contextEnd = Math.min(text.length, end + 40);
  const context = text.slice(contextStart, contextEnd).toLowerCase();

  return STYLE_REFERENCE_CONTEXT_REGEX.test(context);
}

function isMetaSpanText(spanText: string): boolean {
  const normalized = normalizeLabel(spanText);
  if (!normalized) return true;
  
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  // Check 1: Is the entire span just a Taxonomy Label? 
  // e.g. "Action", "Lighting", "Camera Movement"
  if (TAXONOMY_LABELS.has(normalized)) {
    return true;
  }

  // Check 2: Does it start with a Meta Marker and end with a Taxonomy Label?
  // e.g. "Main Action", "Primary Subject", "Key Lighting"
  if (tokens.length >= 2 && tokens.length <= 4) {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    
    if (META_MARKERS.has(firstToken) && TAXONOMY_LABELS.has(lastToken)) {
      return true;
    }
    
    // Also check "The [TaxonomyLabel]"
    if ((firstToken === 'the' || firstToken === 'a') && TAXONOMY_LABELS.has(lastToken)) {
      return true;
    }
  }

  // Check 3: Is it just a Meta Marker?
  // e.g. "Variation 1", "Alternative"
  if (tokens.length === 1 && META_MARKERS.has(tokens[0])) {
    return true;
  }
  
  if (tokens.length === 2 && META_MARKERS.has(tokens[0]) && /\d+/.test(tokens[1])) {
    return true; // "Variation 1"
  }

  return false;
}

export function filterNonVisualSpans(spans: SpanLike[], text: string): FilterResult {
  const notes: string[] = [];
  const altStart = findAlternativeSectionStart(text);

  const filtered = spans.filter((span) => {
    const spanText = typeof span.text === 'string' ? span.text : '';

    if (typeof span.start === 'number' && altStart !== null && span.start >= altStart) {
      notes.push(
        `Dropped alternative-section span "${spanText}" at ${span.start}-${span.end ?? '?'} (role: ${span.role ?? 'unknown'})`
      );
      return false;
    }

    if (spanText && isStyleReferenceSpan(spanText, span, text)) {
      notes.push(
        `Dropped style-reference span "${spanText}" at ${span.start ?? '?'}-${span.end ?? '?'} (role: ${span.role ?? 'unknown'})`
      );
      return false;
    }

    if (spanText && isMetaSpanText(spanText)) {
      notes.push(
        `Dropped non-visual span "${spanText}" at ${span.start ?? '?'}-${span.end ?? '?'} (role: ${span.role ?? 'unknown'})`
      );
      return false;
    }

    return true;
  });

  return { spans: filtered, notes };
}
