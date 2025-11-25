/**
 * Enhancement Suggestions Hook (Orchestrator)
 * 
 * Main hook for managing enhancement suggestions.
 * Orchestrates suggestion fetching and application.
 * 
 * Architecture: Orchestrator pattern
 * Pattern: Delegates to specialized hooks
 * Reference: VideoConceptBuilder hook composition pattern
 * 
 * REFACTORED: Reduced from 289 lines to ~35 lines
 * - Validation logic → utils/spanValidation.js
 * - Span processing → utils/spanUtils.js
 * - Apply logic → hooks/useSuggestionApply.js
 * - Fetch logic → hooks/useSuggestionFetch.js
 */

import { useSuggestionApply } from './useSuggestionApply';
import { useSuggestionFetch } from './useSuggestionFetch';
import type { Toast } from '@hooks/types';

interface PromptOptimizer {
  displayedPrompt: string;
  [key: string]: unknown;
}

interface SuggestionsData {
  show: boolean;
  selectedText: string;
  originalText: string;
  suggestions: Array<{ text: string; [key: string]: unknown }>;
  isLoading: boolean;
  isPlaceholder: boolean;
  fullPrompt: string;
  range?: Range | null;
  offsets?: { start?: number; end?: number } | null;
  metadata?: {
    category?: string;
    span?: {
      category?: string;
      confidence?: number;
      [key: string]: unknown;
    };
    confidence?: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface StablePromptContext {
  [key: string]: unknown;
}

export interface UseEnhancementSuggestionsParams {
  promptOptimizer: PromptOptimizer;
  selectedMode: string;
  suggestionsData: SuggestionsData | null;
  setSuggestionsData: (data: SuggestionsData | null) => void;
  handleDisplayedPromptChange: (prompt: string) => void;
  stablePromptContext: StablePromptContext | null;
  toast: Toast;
}

export interface UseEnhancementSuggestionsReturn {
  fetchEnhancementSuggestions: () => Promise<void>;
  handleSuggestionClick: (suggestion: { text: string; [key: string]: unknown } | string) => Promise<void>;
}

/**
 * Custom hook for enhancement suggestions
 * Handles fetching and applying suggestions for highlighted text
 */
export function useEnhancementSuggestions({
  promptOptimizer,
  selectedMode,
  suggestionsData,
  setSuggestionsData,
  handleDisplayedPromptChange,
  stablePromptContext,
  toast,
}: UseEnhancementSuggestionsParams): UseEnhancementSuggestionsReturn {
  // Handle applying suggestions
  const { handleSuggestionClick } = useSuggestionApply({
    suggestionsData,
    handleDisplayedPromptChange,
    setSuggestionsData,
    toast,
  });

  // Handle fetching suggestions
  const { fetchEnhancementSuggestions } = useSuggestionFetch({
    promptOptimizer,
    selectedMode,
    suggestionsData,
    setSuggestionsData,
    stablePromptContext,
    toast,
    handleSuggestionClick, // Pass down from apply hook
  });

  return {
    fetchEnhancementSuggestions,
    handleSuggestionClick,
  };
}

