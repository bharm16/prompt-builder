/**
 * DEPRECATED: This utility has moved to features/span-highlighting/utils/spanProcessing.ts
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { findNearbySpans, buildSimplifiedSpans, prepareSpanContext } from '@/features/span-highlighting';
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATION] Importing spanUtils from prompt-optimizer/utils is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../../span-highlighting/utils/spanProcessing';

