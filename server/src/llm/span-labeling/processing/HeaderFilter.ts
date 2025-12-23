/**
 * Header and Label Filtering Module
 *
 * Filters out spans that are section headers, category labels, or markdown formatting
 * rather than actual content. These are commonly over-extracted from structured prompts.
 *
 * Problem addressed:
 * - "camera" extracted as span when it's just a section header
 * - "Aspect Ratio" extracted when it's a label, not a value
 * - "## Technical Specs" markdown headers being labeled
 */
import type { SpanLike } from '../types.js';

interface FilterResult {
  spans: SpanLike[];
  notes: string[];
}

/**
 * Patterns that indicate a span is a header/label rather than content
 */
const HEADER_PATTERNS: RegExp[] = [
  // Markdown headers
  /^#{1,6}\s+/,
  
  // Standalone category names (case-insensitive)
  /^(camera|lighting|style|technical|audio|subject|action|environment|shot|composition)\s*:?$/i,
  
  // Common spec labels
  /^(aspect ratio|frame rate|resolution|duration|fps|format)\s*:?$/i,
  
  // Bold section titles like **Camera** or **TECHNICAL SPECS**
  /^\*\*[^*]+\*\*$/,
  
  // Numbered/bulleted list markers alone
  /^[-•*]\s*$/,
  /^\d+[.)]\s*$/,
  
  // All-caps section headers (CAMERA, LIGHTING, etc.)
  /^[A-Z][A-Z\s]{2,}$/,
];

/**
 * Labels that should be filtered when they appear as standalone spans
 * These are common section headers in optimized prompts
 */
const STANDALONE_LABELS = new Set([
  // Main categories
  'camera',
  'lighting', 
  'style',
  'technical',
  'audio',
  'subject',
  'action',
  'environment',
  'shot',
  'composition',
  
  // Technical spec labels
  'aspect ratio',
  'frame rate',
  'resolution',
  'duration',
  'fps',
  'format',
  
  // Common headers
  'technical specs',
  'technical specifications',
  'alternative approaches',
  'alternatives',
  'variations',
  'style reference',
  
  // Angle/movement labels (when standalone)
  'eye-level',
  'eye level',
  'high angle',
  'low angle',
]);

/**
 * Check if a span text matches header/label patterns
 */
function isHeaderOrLabel(text: string): boolean {
  const trimmed = text.trim();
  
  // Empty or very short spans are suspicious
  if (trimmed.length < 2) {
    return true;
  }
  
  // Check against regex patterns
  for (const pattern of HEADER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check against known standalone labels
  const normalized = trimmed.toLowerCase().replace(/[:\-_*#]/g, '').trim();
  if (STANDALONE_LABELS.has(normalized)) {
    return true;
  }
  
  // Check for colon-terminated labels (e.g., "Duration:", "Camera:")
  if (/^[A-Za-z\s]+:\s*$/.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Filter out header and label spans from the extraction results
 *
 * @param spans - Spans to filter
 * @returns Filtered spans and notes about what was removed
 */
export function filterHeaders(spans: SpanLike[]): FilterResult {
  const notes: string[] = [];
  
  const filtered = spans.filter((span) => {
    const text = typeof span.text === 'string' ? span.text : '';
    
    if (isHeaderOrLabel(text)) {
      notes.push(
        `Dropped header/label "${text}" at ${span.start ?? '?'}-${span.end ?? '?'} (role: ${span.role ?? 'unknown'})`
      );
      return false;
    }
    
    return true;
  });
  
  return { spans: filtered, notes };
}

/**
 * Check if text is likely a header (exported for testing)
 */
export function isLikelyHeader(text: string): boolean {
  return isHeaderOrLabel(text);
}
