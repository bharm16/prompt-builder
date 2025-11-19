/**
 * Services Module
 * 
 * Cache and persistence services for span labeling.
 */

// Cache service
export { spanLabelingCache } from './SpanLabelingCache.js';

// Storage adapters
export {
  getCacheStorage,
} from './storageAdapter.js';

