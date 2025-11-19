/**
 * DEPRECATED: This file has moved to features/span-highlighting/utils/anchorRanges.js
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { buildTextNodeIndex, wrapRangeSegments } from '@/features/span-highlighting';
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATION] Importing from utils/anchorRanges.js is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../features/span-highlighting/utils/anchorRanges.js';

