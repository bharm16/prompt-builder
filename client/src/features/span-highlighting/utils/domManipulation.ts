/**
 * DOM Manipulation Utilities
 * 
 * Functions for creating and manipulating highlight wrapper elements.
 */

import { getHighlightClassName, applyHighlightStyles, type HighlightColor } from '../config/highlightStyles.ts';
import { DATASET_KEYS, DEBUG_HIGHLIGHTS } from '../config/constants.ts';

export interface SpanForWrapper {
  category?: string;
  source?: string;
  id?: string;
  start: number;
  end: number;
  startGrapheme?: number;
  endGrapheme?: number;
  validatorPass?: boolean;
  idempotencyKey?: string;
  quote?: string;
  leftCtx?: string;
  rightCtx?: string;
  displayQuote?: string;
  displayLeftCtx?: string;
  displayRightCtx?: string;
  confidence?: number;
  [key: string]: unknown;
}

interface TextNodeIndex {
  nodes: Array<{ node: Node; start: number; end: number }>;
  length: number;
}

/**
 * Create a highlight wrapper element for a span
 */
export function createHighlightWrapper(
  root: HTMLElement,
  span: SpanForWrapper,
  highlightStart: number,
  highlightEnd: number,
  getCategoryColor?: (category?: string) => HighlightColor | undefined
): HTMLSpanElement {
  const el = root.ownerDocument.createElement('span');
  
  // Set CSS class
  el.className = getHighlightClassName(span.category);
  
  // Set core dataset attributes
  el.dataset[DATASET_KEYS.CATEGORY] = span.category;
  el.dataset[DATASET_KEYS.SOURCE] = span.source;
  el.dataset[DATASET_KEYS.SPAN_ID] = span.id;
  el.dataset[DATASET_KEYS.START] = String(span.start);
  el.dataset[DATASET_KEYS.END] = String(span.end);
  el.dataset[DATASET_KEYS.START_DISPLAY] = String(highlightStart);
  el.dataset[DATASET_KEYS.END_DISPLAY] = String(highlightEnd);
  el.dataset[DATASET_KEYS.START_GRAPHEME] = String(span.startGrapheme ?? '');
  el.dataset[DATASET_KEYS.END_GRAPHEME] = String(span.endGrapheme ?? '');
  el.dataset[DATASET_KEYS.VALIDATOR_PASS] = span.validatorPass === false ? 'false' : 'true';
  el.dataset[DATASET_KEYS.IDEMPOTENCY_KEY] = span.idempotencyKey ?? '';
  
  // Apply color styles using injected resolver
  const color = getCategoryColor?.(span.category);
  applyHighlightStyles(el, color);
  
  return el;
}

/**
 * Add additional dataset attributes to wrapper elements
 */
export function enhanceWrapperWithMetadata(wrapper: HTMLElement, span: SpanForWrapper): void {
  wrapper.dataset[DATASET_KEYS.QUOTE] = span.quote ?? '';
  wrapper.dataset[DATASET_KEYS.LEFT_CTX] = span.leftCtx ?? '';
  wrapper.dataset[DATASET_KEYS.RIGHT_CTX] = span.rightCtx ?? '';
  wrapper.dataset[DATASET_KEYS.DISPLAY_QUOTE] = span.displayQuote ?? span.quote ?? '';
  wrapper.dataset[DATASET_KEYS.DISPLAY_LEFT_CTX] = span.displayLeftCtx ?? '';
  wrapper.dataset[DATASET_KEYS.DISPLAY_RIGHT_CTX] = span.displayRightCtx ?? '';
  wrapper.dataset[DATASET_KEYS.SOURCE] = span.source ?? '';
  
  if (typeof span.confidence === 'number') {
    wrapper.dataset[DATASET_KEYS.CONFIDENCE] = String(span.confidence);
  }
}

/**
 * Unwrap a highlighted element, restoring original text nodes
 */
export function unwrapHighlight(element: HTMLElement | null | undefined): void {
  if (!element || !element.parentNode) return;
  const parent = element.parentNode;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

/**
 * Log warning if no wrappers were created
 */
export function logEmptyWrappers(
  span: SpanForWrapper,
  highlightStart: number,
  highlightEnd: number,
  nodeIndex: TextNodeIndex,
  root: HTMLElement
): void {
  if (!DEBUG_HIGHLIGHTS) return;
  
  console.warn('[HIGHLIGHT] wrapRangeSegments returned 0 wrappers for:', {
    text: span.quote,
    role: span.role,
    start: highlightStart,
    end: highlightEnd,
    nodeIndexLength: nodeIndex.nodes?.length,
    rootTextContentLength: root.textContent?.length,
  });
}
