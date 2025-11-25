/**
 * DEPRECATED: This hook has moved to features/span-highlighting/hooks/useHighlightRendering.js
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { useHighlightRendering, useHighlightFingerprint } from '@/features/span-highlighting';
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATION] Importing useHighlightRendering from prompt-optimizer/hooks is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../../span-highlighting/hooks/useHighlightRendering';
export * from '../../span-highlighting/hooks/useHighlightFingerprint';

