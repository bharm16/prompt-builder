/**
 * DEPRECATED: This hook has moved to features/span-highlighting/hooks/useSpanLabeling.js
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { useSpanLabeling, createHighlightSignature } from '@/features/span-highlighting';
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATION] Importing useSpanLabeling from prompt-optimizer/hooks is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../../span-highlighting/hooks/useSpanLabeling';

