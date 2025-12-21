/**
 * Suggestion Apply Hook
 *
 * Handles applying selected suggestions to the prompt.
 * Extracted from useEnhancementSuggestions.js.
 *
 * Architecture: Custom React hook
 * Pattern: Single responsibility - suggestion application
 * Reference: VideoConceptBuilder hooks pattern
 * Line count: ~80 lines (within <150 limit for hooks)
 */

import { useCallback, type MutableRefObject } from 'react';
import { applySuggestionToPrompt } from '@features/prompt-optimizer/utils/applySuggestion';
import { updateHighlightSnapshotForSuggestion } from '@features/prompt-optimizer/utils/updateHighlightSnapshot';
import { useEditHistory } from '@features/prompt-optimizer/hooks/useEditHistory';
import type { Toast } from '@hooks/types';
import type { HighlightSnapshot, SuggestionItem, SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';

interface UseSuggestionApplyParams {
  suggestionsData: SuggestionsData | null;
  handleDisplayedPromptChange: (prompt: string) => void;
  setSuggestionsData: (data: SuggestionsData | null) => void;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  latestHighlightRef: MutableRefObject<HighlightSnapshot | null>;
  toast: Toast;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  promptHistory: {
    updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  };
}

/**
 * Hook for applying suggestions to prompt
 */
export function useSuggestionApply({
  suggestionsData,
  handleDisplayedPromptChange,
  setSuggestionsData,
  applyInitialHighlightSnapshot,
  latestHighlightRef,
  toast,
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
}: UseSuggestionApplyParams): {
  handleSuggestionClick: (suggestion: SuggestionItem | string) => Promise<void>;
} {
  // Initialize edit history tracking
  const { addEdit } = useEditHistory();

  /**
   * Handle suggestion click - apply suggestion to prompt
   */
  const handleSuggestionClick = useCallback(
    async (suggestion: SuggestionItem | string): Promise<void> => {
      const suggestionText =
        typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

      if (!suggestionText || !suggestionsData) return;

      const { selectedText, fullPrompt, offsets, metadata } = suggestionsData;

      try {
        // Apply the suggestion (delegates to utility)
        const result = await applySuggestionToPrompt({
          prompt: fullPrompt,
          suggestionText,
          highlight: selectedText,
          spanMeta: (metadata?.span as Record<string, unknown>) || {},
          ...(metadata ? { metadata: metadata as Record<string, unknown> } : {}),
          ...(offsets ? { offsets: offsets as { start?: number; end?: number } } : {}),
        });

        // Update displayed prompt
        if (result.updatedPrompt) {
          // IMPORTANT: Update highlights BEFORE prompt to prevent race condition
          // When prompt changes, useSpanLabeling checks if initialData matches.
          // If we update prompt first, it sees new text + old initialData = mismatch = API call.
          // By updating highlights first, the signature will match when the prompt updates.
          const targetSpan = (metadata?.span as Record<string, unknown> | undefined) ?? undefined;
          const updatedHighlights = updateHighlightSnapshotForSuggestion({
            snapshot: latestHighlightRef.current,
            matchStart: result.matchStart ?? offsets?.start ?? null,
            matchEnd: result.matchEnd ?? offsets?.end ?? null,
            replacementText: suggestionText,
            nextPrompt: result.updatedPrompt,
            targetSpanId:
              (targetSpan?.id as string | null | undefined) ??
              (metadata?.spanId as string | null | undefined) ??
              null,
            targetStart:
              (targetSpan?.start as number | null | undefined) ??
              (metadata?.start as number | null | undefined) ??
              offsets?.start ??
              null,
            targetEnd:
              (targetSpan?.end as number | null | undefined) ??
              (metadata?.end as number | null | undefined) ??
              offsets?.end ??
              null,
            targetCategory:
              (targetSpan?.category as string | null | undefined) ??
              (metadata?.category as string | null | undefined) ??
              null,
          });

          if (updatedHighlights) {
            // Debug: trace what we're applying
            if (typeof console !== 'undefined' && typeof console.debug === 'function') {
              console.debug('[useSuggestionApply] applying highlight update:', {
                spansCount: updatedHighlights.spans?.length,
                signature: updatedHighlights.signature?.slice(0, 16),
                hasLocalUpdate: updatedHighlights.meta?.localUpdate,
                version: updatedHighlights.meta?.version,
                spans: updatedHighlights.spans?.map((s) => ({
                  start: s.start,
                  end: s.end,
                  category: s.category,
                })),
              });
            }
            applyInitialHighlightSnapshot(updatedHighlights, {
              bumpVersion: true,
              markPersisted: false,
            });
          }

          // Now update the prompt - initialData is already set with matching signature
          handleDisplayedPromptChange(result.updatedPrompt);
          toast.success('Suggestion applied');

          // Track this edit in history
          addEdit({
            original: selectedText,
            replacement: suggestionText,
            category:
              metadata?.category || metadata?.span?.category || null,
            position: offsets?.start || null,
            confidence:
              metadata?.confidence || metadata?.span?.confidence || null,
          });

          // Persist the updated prompt to database/storage
          if (currentPromptUuid && result.updatedPrompt) {
            try {
              promptHistory.updateEntryOutput(
                currentPromptUuid,
                currentPromptDocId,
                result.updatedPrompt
              );
            } catch (error) {
              // Don't block UI if save fails - just log warning
              console.warn('Failed to persist suggestion update:', error);
            }
          }
        } else {
          toast.error('Could not locate text to replace');
        }

        // Close suggestions panel
        setSuggestionsData(null);
      } catch (error) {
        console.error('Error applying suggestion:', error);
        toast.error('Failed to apply suggestion');
      }
    },
    [
      suggestionsData,
      handleDisplayedPromptChange,
      setSuggestionsData,
      applyInitialHighlightSnapshot,
      latestHighlightRef,
      toast,
      addEdit,
      currentPromptUuid,
      currentPromptDocId,
      promptHistory,
    ]
  );

  return {
    handleSuggestionClick,
  };
}
