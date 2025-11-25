/**
 * Hooks Module
 * 
 * React hooks for span labeling and highlighting.
 */

// Main hooks
export {
  useSpanLabeling,
  createHighlightSignature,
} from './useSpanLabeling.js';

export { useHighlightRendering } from './useHighlightRendering.js';

// Supporting hooks
export { useHighlightFingerprint } from './useHighlightFingerprint';
export { useHighlightSourceSelection } from './useHighlightSourceSelection.js';
export { useProgressiveSpanRendering } from './useProgressiveSpanRendering.js';

