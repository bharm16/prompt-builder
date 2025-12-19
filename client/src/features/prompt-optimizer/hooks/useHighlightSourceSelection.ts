/**
 * DEPRECATED: This hook has moved to features/span-highlighting/hooks/useHighlightSourceSelection.ts
 * 
 * This re-export will be removed in a future version.
 * Please update your imports to use the new location:
 * 
 * import { useHighlightSourceSelection } from '@/features/span-highlighting';
 */

if (process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATION] Importing useHighlightSourceSelection from prompt-optimizer/hooks is deprecated. ' +
    'Please import from @/features/span-highlighting instead.'
  );
}

export * from '../../span-highlighting/hooks/useHighlightSourceSelection';

