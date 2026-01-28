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
import { updateSpanListForSuggestion } from '@features/prompt-optimizer/utils/updateSpanListForSuggestion';
import { useEditHistory } from '@features/prompt-optimizer/hooks/useEditHistory';
import type { Toast } from '@hooks/types';
import type { HighlightSnapshot, SuggestionItem, SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';
import type { CoherenceCheckRequest, CoherenceSpan } from '@features/prompt-optimizer/types/coherence';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';

const log = logger.child('useSuggestionApply');

const buildCoherenceSpansFromSnapshot = (
  snapshot: HighlightSnapshot | null,
  prompt: string
): CoherenceSpan[] => {
  if (!snapshot || !Array.isArray(snapshot.spans) || !prompt) {
    return [];
  }

  const mapped = snapshot.spans.map((span, index): CoherenceSpan | null => {
    const start = typeof span.start === 'number' ? span.start : null;
    const end = typeof span.end === 'number' ? span.end : null;
    if (start === null || end === null || end <= start) {
      return null;
    }

    const safeStart = Math.max(0, Math.min(start, prompt.length));
    const safeEnd = Math.max(safeStart, Math.min(end, prompt.length));
    const text = prompt.slice(safeStart, safeEnd).trim();
    if (!text) {
      return null;
    }

    return {
      id: `span_${safeStart}_${safeEnd}_${index}`,
      start: safeStart,
      end: safeEnd,
      category: span.category,
      confidence: span.confidence,
      text,
      quote: text,
    };
  });

  return mapped.filter((span): span is CoherenceSpan => span !== null);
};

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
  onCoherenceCheck?: ((payload: CoherenceCheckRequest) => Promise<void> | void) | undefined;
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
  onCoherenceCheck,
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
            if (import.meta.env.DEV) {
              log.debug('Applying highlight update', {
                spansCount: updatedHighlights.spans?.length,
                signaturePrefix: updatedHighlights.signature?.slice(0, 16),
                hasLocalUpdate: updatedHighlights.meta?.localUpdate,
                version: updatedHighlights.meta?.version,
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

          const targetSpanId =
            (targetSpan?.id as string | null | undefined) ??
            (metadata?.spanId as string | null | undefined) ??
            null;

          if (onCoherenceCheck) {
            const baseSpans = Array.isArray(suggestionsData.allLabeledSpans)
              ? suggestionsData.allLabeledSpans
              : [];
            const updatedSpans = updateSpanListForSuggestion({
              spans: baseSpans,
              matchStart: result.matchStart ?? offsets?.start ?? null,
              matchEnd: result.matchEnd ?? offsets?.end ?? null,
              replacementText: suggestionText,
              targetSpanId,
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

            const fallbackSpans = buildCoherenceSpansFromSnapshot(
              updatedHighlights ?? latestHighlightRef.current,
              result.updatedPrompt
            );
            const coherenceSpans = updatedSpans.length > 0 ? updatedSpans : fallbackSpans;

            if (coherenceSpans.length > 0) {
              void onCoherenceCheck({
                beforePrompt: fullPrompt,
                afterPrompt: result.updatedPrompt,
                appliedChange: {
                  spanId: targetSpanId ?? undefined,
                  category:
                    (targetSpan?.category as string | null | undefined) ??
                    (metadata?.category as string | null | undefined) ??
                    undefined,
                  oldText: selectedText,
                  newText: suggestionText,
                },
                spans: coherenceSpans,
              });
            }
          }

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
              const info = sanitizeError(error);
              log.warn('Failed to persist suggestion update', {
                operation: 'updateEntryOutput',
                error: info.message,
                errorName: info.name,
                promptUuid: currentPromptUuid,
                promptDocId: currentPromptDocId ?? null,
              });
            }
          }
        } else {
          toast.error('Could not locate text to replace');
        }

        // Close suggestions panel
        setSuggestionsData(null);
      } catch (error) {
        const errObj = error instanceof Error ? error : new Error(sanitizeError(error).message);
        log.error('Error applying suggestion', errObj, { operation: 'handleSuggestionClick' });
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
      onCoherenceCheck,
    ]
  );

  return {
    handleSuggestionClick,
  };
}
