/**
 * DEPRECATED: This utility has moved to features/span-highlighting/utils/highlightConversion.ts
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { convertLabeledSpansToHighlights } from '@/features/span-highlighting';
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATION] Importing highlightConversion from prompt-optimizer/utils is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../../span-highlighting/utils/highlightConversion';

