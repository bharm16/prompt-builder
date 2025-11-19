/**
 * Utilities Module
 * 
 * Barrel export for all utility functions.
 * Pure functions with no side effects.
 */

// DOM utilities - Text node manipulation
export {
  buildTextNodeIndex,
  mapGlobalRangeToDom,
  surroundRange,
  wrapRangeSegments,
} from './anchorRanges.js';

// DOM utilities - Highlight wrapper management
export {
  createHighlightWrapper,
  enhanceWrapperWithMetadata,
  unwrapHighlight,
  logEmptyWrappers,
} from './domManipulation.js';

// DOM utilities - Coverage tracking
export {
  hasOverlap,
  addToCoverage,
} from './coverageTracking.js';

// Validation - Category and taxonomy validation
export {
  validateSpan,
  CATEGORY_CAPS,
  LEGACY_MAPPINGS,
} from './categoryValidators.js';

// Validation - Span structure validation
export {
  sanitizeSpans,
  normalizeSpan,
} from './spanValidation.js';

// Validation - Token boundaries
export {
  isWordBoundary,
  snapSpanToTokenBoundaries,
  rangeOverlaps,
} from './tokenBoundaries.js';

// Processing - Business logic for spans
export {
  findNearbySpans,
  buildSimplifiedSpans,
  prepareSpanContext,
} from './spanProcessing.js';

// Processing - Rendering preparation
export {
  hasValidOffsets,
  snapSpan,
  processAndSortSpans,
} from './spanRenderingUtils.js';

// Processing - Text matching
export {
  normalizeText,
  isSubstringMatch,
  validateHighlightText,
} from './textMatching.js';

// Processing - Highlight format conversion
export {
  convertLabeledSpansToHighlights,
} from './highlightConversion.js';

// Cache utilities - Hashing
export {
  hashString,
} from './hashing.js';

// Cache utilities - Cache key generation
export {
  buildCacheKey,
} from './cacheKey.js';

// Cache utilities - Text processing
export {
  sanitizeText,
  serializePolicy,
} from './textUtils.js';

