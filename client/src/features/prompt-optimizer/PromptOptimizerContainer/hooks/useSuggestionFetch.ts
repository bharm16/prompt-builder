/**
 * Suggestion Fetch Hook
 *
 * Handles fetching enhancement suggestions for highlighted text.
 * Extracted from useEnhancementSuggestions.js.
 *
 * Architecture: Custom React hook
 * Pattern: Single responsibility - suggestion fetching
 * Reference: VideoConceptBuilder hooks pattern
 * Line count: ~150 lines (within <150 limit for hooks)
 */

import { useCallback } from 'react';
import type React from 'react';
import { fetchEnhancementSuggestions as fetchSuggestionsAPI } from '../../api/enhancementSuggestionsApi';
import { prepareSpanContext } from '../../utils/spanUtils.ts';
import { useEditHistory } from '../../hooks/useEditHistory';
import type { Toast } from '../../../../hooks/types';

interface PromptOptimizer {
  displayedPrompt: string;
  inputPrompt: string;
  setDisplayedPrompt: (prompt: string) => void;
  setOptimizedPrompt: (prompt: string) => void;
  [key: string]: unknown;
}

interface Suggestion {
  text: string;
  [key: string]: unknown;
}

interface SuggestionsData {
  show: boolean;
  selectedText: string;
  originalText: string;
  suggestions: Suggestion[];
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
      startIndex?: number;
      [key: string]: unknown;
    };
    confidence?: number;
    [key: string]: unknown;
  } | null;
  setSuggestions?: (suggestions: Suggestion[], isPlaceholder?: boolean) => void;
  onSuggestionClick?: (suggestion: Suggestion | string) => Promise<void>;
  onClose?: () => void;
}

interface FetchPayload {
  highlightedText?: string;
  originalText?: string;
  displayedPrompt?: string;
  range?: Range | null;
  offsets?: { start?: number; end?: number } | null;
  metadata?: SuggestionsData['metadata'];
  trigger?: string;
  allLabeledSpans?: unknown[];
}

type SetSuggestionsData = React.Dispatch<React.SetStateAction<SuggestionsData | null>>;

interface UseSuggestionFetchParams {
  promptOptimizer: PromptOptimizer;
  selectedMode: string;
  suggestionsData: SuggestionsData | null;
  setSuggestionsData: SetSuggestionsData;
  stablePromptContext: unknown;
  toast: Toast;
  handleSuggestionClick: (suggestion: Suggestion | string) => Promise<void>;
}

/**
 * Hook for fetching enhancement suggestions
 */
export function useSuggestionFetch({
  promptOptimizer,
  selectedMode,
  suggestionsData,
  setSuggestionsData,
  stablePromptContext,
  toast,
  handleSuggestionClick,
}: UseSuggestionFetchParams): {
  fetchEnhancementSuggestions: (payload?: FetchPayload) => Promise<void>;
} {
  const { getEditSummary } = useEditHistory();

  /**
   * Fetch enhancement suggestions for highlighted text
   */
  const fetchEnhancementSuggestions = useCallback(
    async (payload: FetchPayload = {}): Promise<void> => {
      const {
        highlightedText,
        originalText,
        displayedPrompt: payloadPrompt,
        range,
        offsets,
        metadata: rawMetadata = null,
        trigger = 'highlight',
        allLabeledSpans = [],
      } = payload;

      const trimmedHighlight = (highlightedText || '').trim();
      const rawPrompt = payloadPrompt ?? promptOptimizer.displayedPrompt ?? '';
      const normalizedPrompt = rawPrompt.normalize('NFC');
      const metadata: SuggestionsData['metadata'] = rawMetadata
        ? ({
            ...rawMetadata,
            span: rawMetadata.span ? { ...rawMetadata.span } : undefined,
          } as SuggestionsData['metadata'])
        : null;

      // Early returns for invalid cases
      if (selectedMode !== 'video' || !trimmedHighlight) {
        return;
      }

      // Avoid duplicate requests
      if (
        suggestionsData?.selectedText === trimmedHighlight &&
        suggestionsData?.show
      ) {
        return;
      }

      // Show loading state immediately
      const initialData: SuggestionsData = {
        show: true,
        selectedText: trimmedHighlight,
        originalText: originalText || trimmedHighlight,
        suggestions: [],
        isLoading: true,
        isPlaceholder: false,
        fullPrompt: normalizedPrompt,
        range: range ?? null,
        offsets: offsets ?? null,
        metadata: metadata ?? null,
        setSuggestions: (newSuggestions, newIsPlaceholder) => {
          setSuggestionsData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              suggestions: newSuggestions,
              isPlaceholder:
                newIsPlaceholder !== undefined
                  ? newIsPlaceholder
                  : prev.isPlaceholder,
            };
          });
        },
        onSuggestionClick: handleSuggestionClick,
        onClose: () => setSuggestionsData(null),
      };
      setSuggestionsData(initialData);

      try {
        // Prepare span context (sanitized and validated)
        const spanContext = prepareSpanContext(
          metadata as Record<string, unknown>,
          allLabeledSpans
        ) as { simplifiedSpans: unknown[]; nearbySpans: unknown[] };
        const { simplifiedSpans, nearbySpans } = spanContext;

        // Get edit history for context
        const editHistory = getEditSummary(10);

        // Delegate to API layer (VideoConceptBuilder pattern)
        const { suggestions, isPlaceholder } = await fetchSuggestionsAPI({
          highlightedText: trimmedHighlight,
          normalizedPrompt,
          inputPrompt: promptOptimizer.inputPrompt,
          brainstormContext: stablePromptContext ?? null,
          metadata: metadata ?? null,
          allLabeledSpans: simplifiedSpans,
          nearbySpans: nearbySpans,
          editHistory,
        });

        // Update with results
        setSuggestionsData((prev) => {
          if (!prev) return prev;
          const suggestionsAsObjects: Suggestion[] = suggestions.map((s) =>
            typeof s === 'string' ? { text: s } : s
          );
          return {
            ...prev,
            suggestions: suggestionsAsObjects,
            isLoading: false,
            isPlaceholder,
          };
        });
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast.error('Failed to load suggestions');

        setSuggestionsData((prev) => {
          if (!prev) return null;
          const updated: SuggestionsData = {
            ...prev,
            isLoading: false,
            suggestions: [
              { text: 'Failed to load suggestions. Please try again.' } as Suggestion,
            ],
          };
          return updated;
        });
      }
    },
    [
      promptOptimizer,
      selectedMode,
      suggestionsData?.selectedText,
      suggestionsData?.show,
      setSuggestionsData,
      stablePromptContext,
      toast,
      handleSuggestionClick,
      getEditSummary,
    ]
  );

  return {
    fetchEnhancementSuggestions,
  };
}

