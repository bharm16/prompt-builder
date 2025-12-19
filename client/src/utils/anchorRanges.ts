/**
 * DEPRECATED: This file has moved to features/span-highlighting/utils/anchorRanges.ts
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { buildTextNodeIndex, wrapRangeSegments } from '@/features/span-highlighting';
 */

if (import.meta.env.DEV) {
  console.warn(
    '[DEPRECATION] Importing from utils/anchorRanges.ts is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../features/span-highlighting/utils/anchorRanges';

