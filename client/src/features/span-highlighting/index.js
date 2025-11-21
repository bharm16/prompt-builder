/**
 * Span Highlighting Module
 * 
 * Unified module for span labeling and text highlighting functionality.
 * Provides hooks, utilities, and services for:
 * - AI-powered span labeling
 * - DOM-based text highlighting
 * - Span validation and processing
 * - Cache management
 * 
 * @module span-highlighting
 */

// ============================================================================
// HOOKS (Primary API)
// ============================================================================

export {
  useSpanLabeling,
  useHighlightRendering,
  useHighlightSourceSelection,
  useProgressiveSpanRendering,
  useHighlightFingerprint,
  createHighlightSignature,
} from './hooks/index.js';

// ============================================================================
// UTILITIES (Secondary API)
// ============================================================================

// DOM utilities - Most commonly used
export {
  buildTextNodeIndex,
  wrapRangeSegments,
  mapGlobalRangeToDom,
} from './utils/anchorRanges.js';

// Validation - Most commonly used
export {
  validateSpan,
  sanitizeSpans,
  normalizeSpan,
  snapSpanToTokenBoundaries,
} from './utils/index.js';

// Processing - Most commonly used
export {
  findNearbySpans,
  buildSimplifiedSpans,
  prepareSpanContext,
} from './utils/spanProcessing.js';

// Cache utilities - Most commonly used
export {
  hashString,
  sanitizeText,
} from './utils/index.js';

// ============================================================================
// SERVICES (Advanced API)
// ============================================================================

export { spanLabelingCache } from './services/index.js';
export { SpanLabelingApi } from './api/index.js';

// ============================================================================
// CONFIGURATION (Exports for customization)
// ============================================================================

export {
  DEFAULT_POLICY,
  DEFAULT_OPTIONS,
} from './config/index.js';

export {
  CATEGORY_CAPS,
} from './utils/index.js';

// ============================================================================
// NAMESPACE EXPORTS (For organized imports)
// ============================================================================

import * as spanHooks from './hooks/index.js';
import * as spanUtils from './utils/index.js';
import * as spanConfig from './config/index.js';
import * as spanServices from './services/index.js';
import * as spanApi from './api/index.js';

export { spanHooks, spanUtils, spanConfig, spanServices, spanApi };

