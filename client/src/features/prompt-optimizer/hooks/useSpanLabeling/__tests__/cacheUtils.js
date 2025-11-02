/**
 * Test utilities for span labeling cache
 *
 * Provides access to cache internals for testing purposes.
 */

import { spanLabelingCache } from '../services/SpanLabelingCache.js';

/**
 * Clears all cache entries and resets hydration state
 * Used in tests to ensure clean state between test runs
 */
export const __clearSpanLabelingCache = () => {
  spanLabelingCache.clear();
};

/**
 * Gets a snapshot of current cache contents for debugging
 * @returns {Array} Array of cache entry summaries
 */
export const __getSpanLabelingCacheSnapshot = () => {
  return spanLabelingCache.getSnapshot();
};
