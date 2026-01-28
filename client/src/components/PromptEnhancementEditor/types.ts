import type React from 'react';

export interface HighlightMetadata {
  category: string | null;
  phrase: string | null;
  confidence: number | null;
}

export interface Suggestion {
  text: string;
  [key: string]: unknown;
}

export interface SuggestionsState {
  show: boolean;
  selectedText: string;
  suggestions: Suggestion[];
  isLoading: boolean;
  isPlaceholder: boolean;
  highlightMetadata: HighlightMetadata | null;
  fullPrompt: string;
  setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
  onSuggestionClick: (suggestion: Suggestion | string) => void;
  onClose: () => void;
}

export interface PromptEnhancementEditorProps {
  promptContent: string;
  onPromptUpdate: (prompt: string) => void;
  originalUserPrompt?: string;
  onShowSuggestionsChange?: (state: SuggestionsState) => void;
}

export interface EnhancementEditorState {
  selectedText: string;
  selectionRange: Range | null;
  suggestions: Suggestion[];
  isLoading: boolean;
  showSuggestions: boolean;
  isPlaceholder: boolean;
  highlightMetadata: HighlightMetadata | null;
}
