/**
 * Centralized configuration for semantic analysis and NLP tasks.
 * Defines vocabulary lists, stop words, and structural markers.
 * 
 * Replaces scattered hardcoded lists in services.
 */

// Common English stop words that break verb phrases
export const ACTION_STOP_WORDS = new Set([
  'and', 'then', 'while', 'as', 'but', 'or', 'nor', 'yet', 'so', 'because',
  'although', 'though', 'whereas', 'if', 'when', 'in', 'on', 'with', 'at',
  'into', 'through', 'along', 'across', 'over', 'under', 'near', 'by', 'from',
  'toward', 'towards', 'around', 'inside', 'outside', 'within', 'beneath',
  'above', 'behind', 'between', 'before', 'after', 'past',
]);

// Adverbs that shouldn't start a verb phrase
export const ACTION_ADVERB_BLACKLIST = new Set(['family']);

// Words that indicate a section header (e.g. "**Camera:**") rather than content
export const SECTION_HEADER_WORDS = new Set([
  'camera',
  'style',
  'audio',
  'sound',
  'lighting',
  'duration',
  'technical',
  'specs',
  'specifications',
  'environment',
  'subject',
  'action',
  'shot',
  'movement',
  'composition',
  'framing',
  'alternatives',
  'notes',
  'description',
]);

// Words that indicate a meta-description or alternative option rather than visual content
export const META_MARKERS = new Set([
  'main',
  'primary',
  'core',
  'key',
  'different',
  'alternate',
  'alternative',
  'variation',
  'approach',
  'version',
  'option'
]);

// Regex for detecting alternative sections in prompts
export const ALTERNATIVE_SECTION_REGEX = /(?:^|\n)\s*(?:\*{0,2}|#{1,6})?\s*(alternative approaches|alternative approach|alternatives|variations)\b/i;

// Regex for detecting style references
export const STYLE_REFERENCE_CONTEXT_REGEX = /\b(style reference|inspired by|reminiscent of|akin to|in the style of|inspired by the works of|inspired by the work of)\b/i;
