export { default } from './PromptEnhancementEditor';
export { default as PromptEnhancementEditor } from './PromptEnhancementEditor';

// Re-export types for consumers
export type {
  HighlightMetadata,
  Suggestion,
  SuggestionsState,
  PromptEnhancementEditorProps,
} from './types';

// Re-export hook for advanced usage
export { useEnhancementEditor } from './hooks/useEnhancementEditor';

// Re-export API for direct usage
export { fetchEnhancementSuggestions } from './api/enhancementApi';

// Re-export utils for testing
export { extractMetadataFromSelection, cleanSelectedText } from './utils/selectionUtils';
