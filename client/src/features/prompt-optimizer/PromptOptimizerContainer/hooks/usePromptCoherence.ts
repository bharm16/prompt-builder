import { useCallback, type MutableRefObject } from 'react';
import { sanitizeError } from '@/utils/logging';
import type { PromptHistory, PromptOptimizer } from '../../context/types';
import type { HighlightSnapshot } from '../../context/types';
import type { CoherenceRecommendation } from '../../types/coherence';
import { useCoherenceAnnotations, type CoherenceIssue } from '../../components/coherence/useCoherenceAnnotations';
import { applyCoherenceRecommendation } from '../../utils/applyCoherenceRecommendation';

type LoggerLike = {
  warn: (message: string, context?: Record<string, unknown>) => void;
};

type UsePromptCoherenceParams = {
  promptOptimizer: Pick<PromptOptimizer, 'displayedPrompt'>;
  latestHighlightRef: MutableRefObject<HighlightSnapshot | null>;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options?: { bumpVersion?: boolean; markPersisted?: boolean }
  ) => void;
  handleDisplayedPromptChange: (text: string) => void;
  currentPromptUuid: string | null | undefined;
  currentPromptDocId: string | null | undefined;
  promptHistory: Pick<PromptHistory, 'updateEntryOutput'>;
  toast: { info: (msg: string) => void; success: (msg: string) => void };
  log: LoggerLike;
};

export function usePromptCoherence({
  promptOptimizer,
  latestHighlightRef,
  applyInitialHighlightSnapshot,
  handleDisplayedPromptChange,
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
  toast,
  log,
}: UsePromptCoherenceParams): ReturnType<typeof useCoherenceAnnotations> {
  const displayedPrompt = promptOptimizer.displayedPrompt;
  const updateEntryOutput = promptHistory.updateEntryOutput;
  const handleApplyCoherenceFix = useCallback(
    (recommendation: CoherenceRecommendation, issue: CoherenceIssue): boolean => {
      const currentPrompt = displayedPrompt;
      if (!currentPrompt) {
        return false;
      }

      const result = applyCoherenceRecommendation({
        recommendation,
        prompt: currentPrompt,
        spans: issue.spans,
        highlightSnapshot: latestHighlightRef.current,
      });

      if (!result.updatedPrompt) {
        return false;
      }

      if (result.updatedSnapshot) {
        applyInitialHighlightSnapshot(result.updatedSnapshot, {
          bumpVersion: true,
          markPersisted: false,
        });
      }

      handleDisplayedPromptChange(result.updatedPrompt);

      if (currentPromptUuid) {
        try {
          updateEntryOutput(currentPromptUuid, currentPromptDocId ?? null, result.updatedPrompt);
        } catch (error) {
          const info = sanitizeError(error);
          log.warn('Failed to persist coherence edits', {
            operation: 'updateEntryOutput',
            promptUuid: currentPromptUuid,
            promptDocId: currentPromptDocId ?? null,
            error: info.message,
            errorName: info.name,
          });
        }
      }

      return true;
    },
    [
      applyInitialHighlightSnapshot,
      currentPromptDocId,
      currentPromptUuid,
      handleDisplayedPromptChange,
      latestHighlightRef,
      log,
      updateEntryOutput,
      displayedPrompt,
    ]
  );

  return useCoherenceAnnotations({
    onApplyFix: handleApplyCoherenceFix,
    toast,
  });
}
