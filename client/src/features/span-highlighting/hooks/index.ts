/**
 * Hooks Module
 * 
 * React hooks for span labeling and highlighting.
 */

// Main hooks
export {
  useSpanLabeling,
  createHighlightSignature,
} from './useSpanLabeling';

export { useHighlightRendering } from './useHighlightRendering';

// Supporting hooks
export { useHighlightFingerprint } from './useHighlightFingerprint';
export { useHighlightSourceSelection } from './useHighlightSourceSelection';
export { useProgressiveSpanRendering } from './useProgressiveSpanRendering';

