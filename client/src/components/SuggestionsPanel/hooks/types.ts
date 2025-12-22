/**
 * Type definitions for SuggestionsPanel hooks
 */

export interface SuggestionItem {
  id?: string;
  text?: string;
  category?: string;
  suggestions?: SuggestionItem[];
  compatibility?: number;
  explanation?: string;
  [key: string]: unknown;
}

export interface CategoryGroup {
  category: string;
  suggestions: SuggestionItem[];
}

export interface SuggestionsState {
  suggestions: SuggestionItem[];
  activeCategory: string | null;
  isLoading: boolean;
}

// Discriminated union for reducer actions
export type SuggestionsAction =
  | { type: 'SET_SUGGESTIONS'; payload: SuggestionItem[] }
  | { type: 'SET_ACTIVE_CATEGORY'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean };
