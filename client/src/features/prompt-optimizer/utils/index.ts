/**
 * Prompt optimizer utilities.
 * Re-exports all utility modules for convenient imports.
 */

// Signal utilities for request cancellation
export { CancellationError, isCancellationError, combineSignals } from './signalUtils';

// Request manager for debounce, cancellation, and deduplication
export { SuggestionRequestManager } from './SuggestionRequestManager';
export type { RequestManagerConfig } from './SuggestionRequestManager';

// Cache for suggestion results
export { SuggestionCache, simpleHash } from './SuggestionCache';
export type { CacheConfig } from './SuggestionCache';

// Existing utilities
export * from './applySuggestion';
export * from './highlightInteractionHelpers';
export * from './textFormatting';
export * from './textSelection';
export * from './updateHighlightSnapshot';
