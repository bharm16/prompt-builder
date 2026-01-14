import { useCallback, useState } from 'react';
import { checkPromptCoherence } from '@features/prompt-optimizer/api/coherenceCheckApi';
import { applySpanEditToPrompt } from '@features/prompt-optimizer/utils/applySpanEdit';
import { updateSpanListForSuggestion } from '@features/prompt-optimizer/utils/updateSpanListForSuggestion';
import {
  updateHighlightSnapshotForSuggestion,
  updateHighlightSnapshotForRemoval,
} from '@features/prompt-optimizer/utils/updateHighlightSnapshot';
import type { HighlightSnapshot } from '@features/prompt-optimizer/PromptCanvas/types';
import type { PromptOptimizer } from '@features/prompt-optimizer/context/types';
import type { Toast } from '@hooks/types';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import type {
  CoherenceCheckRequest,
  CoherenceCheckResult,
  CoherenceFinding,
  CoherenceRecommendation,
  CoherenceReviewData,
} from '@features/prompt-optimizer/types/coherence';

const log = logger.child('useCoherenceReview');

const buildFindingIds = (
  findings: CoherenceFinding[],
  prefix: string
): CoherenceFinding[] =>
  findings.map((finding, index) => ({
    ...finding,
    id: finding.id || `${prefix}_finding_${index}_${Date.now()}`,
    severity: finding.severity || (prefix === 'conflict' ? 'medium' : 'suggestion'),
    recommendations: (finding.recommendations || []).map((rec, recIndex) => ({
      ...rec,
      id: rec.id || `${prefix}_rec_${index}_${recIndex}_${Date.now()}`,
    })),
  }));

const normalizeResult = (result: CoherenceCheckResult): CoherenceCheckResult => ({
  conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
  harmonizations: Array.isArray(result.harmonizations) ? result.harmonizations : [],
});

export interface UseCoherenceReviewParams {
  promptOptimizer: PromptOptimizer;
  handleDisplayedPromptChange: (prompt: string) => void;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  latestHighlightRef: React.MutableRefObject<HighlightSnapshot | null>;
  toast: Toast;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  promptHistory: {
    updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  };
}

export interface UseCoherenceReviewReturn {
  reviewData: CoherenceReviewData | null;
  isChecking: boolean;
  isApplying: boolean;
  runCoherenceCheck: (payload: CoherenceCheckRequest) => Promise<void>;
  applyRecommendations: (recommendationIds: string[]) => Promise<void>;
  dismissReview: () => void;
}

export function useCoherenceReview({
  promptOptimizer,
  handleDisplayedPromptChange,
  applyInitialHighlightSnapshot,
  latestHighlightRef,
  toast,
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
}: UseCoherenceReviewParams): UseCoherenceReviewReturn {
  const [reviewData, setReviewData] = useState<CoherenceReviewData | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const runCoherenceCheck = useCallback(
    async (payload: CoherenceCheckRequest): Promise<void> => {
      if (!payload?.beforePrompt || !payload?.afterPrompt) {
        return;
      }

      const spans = Array.isArray(payload.spans) ? payload.spans : [];
      if (!spans.length) {
        return;
      }

      setIsChecking(true);
      toast.info('Checking coherence...');

      try {
        const result = normalizeResult(await checkPromptCoherence(payload));
        const hasFindings =
          result.conflicts.length > 0 || result.harmonizations.length > 0;
        if (!hasFindings) {
          return;
        }

        setReviewData({
          beforePrompt: payload.beforePrompt,
          afterPrompt: payload.afterPrompt,
          appliedChange: payload.appliedChange,
          spans,
          conflicts: buildFindingIds(result.conflicts, 'conflict'),
          harmonizations: buildFindingIds(result.harmonizations, 'harmonization'),
        });
      } catch (error) {
        const info = sanitizeError(error);
        log.warn('Coherence check failed', {
          operation: 'runCoherenceCheck',
          error: info.message,
          errorName: info.name,
        });
      } finally {
        setIsChecking(false);
      }
    },
    [toast]
  );

  const applyRecommendations = useCallback(
    async (recommendationIds: string[]): Promise<void> => {
      if (!reviewData || recommendationIds.length === 0) {
        return;
      }

      setIsApplying(true);

      try {
        const selected = new Set(recommendationIds);
        const selections: CoherenceRecommendation[] = [];

        const collectSelections = (finding: CoherenceFinding): void => {
          finding.recommendations?.forEach((rec) => {
            if (rec.id && selected.has(rec.id)) {
              selections.push(rec);
            }
          });
        };

        reviewData.conflicts.forEach(collectSelections);
        reviewData.harmonizations.forEach(collectSelections);

        if (selections.length === 0) {
          return;
        }

        let workingPrompt =
          promptOptimizer.displayedPrompt || reviewData.afterPrompt || '';
        let workingSnapshot = latestHighlightRef.current;
        let workingSpans = [...reviewData.spans];

        selections.forEach((rec) => {
          rec.edits.forEach((edit) => {
            const span = edit.spanId
              ? workingSpans.find((candidate) => candidate.id === edit.spanId) ?? null
              : null;

            const result = applySpanEditToPrompt({
              prompt: workingPrompt,
              edit,
              span: span ?? null,
            });

            if (!result.updatedPrompt || !Number.isFinite(result.matchStart) || !Number.isFinite(result.matchEnd)) {
              return;
            }

            const matchStart = result.matchStart as number;
            const matchEnd = result.matchEnd as number;
            const replacementText =
              edit.type === 'replaceSpanText' ? edit.replacementText ?? '' : '';

            if (edit.type === 'replaceSpanText') {
              workingSnapshot = updateHighlightSnapshotForSuggestion({
                snapshot: workingSnapshot,
                matchStart,
                matchEnd,
                replacementText,
                nextPrompt: result.updatedPrompt,
                targetSpanId: span?.id ?? null,
                targetStart: span?.start ?? null,
                targetEnd: span?.end ?? null,
                targetCategory: span?.category ?? null,
              });
            } else {
              workingSnapshot = updateHighlightSnapshotForRemoval({
                snapshot: workingSnapshot,
                matchStart,
                matchEnd,
                nextPrompt: result.updatedPrompt,
                targetSpanId: span?.id ?? null,
                targetStart: span?.start ?? null,
                targetEnd: span?.end ?? null,
                targetCategory: span?.category ?? null,
              });
            }

            workingSpans = updateSpanListForSuggestion({
              spans: workingSpans,
              matchStart,
              matchEnd,
              replacementText,
              targetSpanId: span?.id ?? null,
              targetStart: span?.start ?? null,
              targetEnd: span?.end ?? null,
              targetCategory: span?.category ?? null,
              removeTarget: edit.type === 'removeSpan',
            });

            workingPrompt = result.updatedPrompt;
          });
        });

        if (!workingPrompt || workingPrompt === promptOptimizer.displayedPrompt) {
          return;
        }

        if (workingSnapshot) {
          applyInitialHighlightSnapshot(workingSnapshot, {
            bumpVersion: true,
            markPersisted: false,
          });
        }

        handleDisplayedPromptChange(workingPrompt);
        toast.success('Applied coherence fixes');

        if (currentPromptUuid) {
          try {
            promptHistory.updateEntryOutput(
              currentPromptUuid,
              currentPromptDocId,
              workingPrompt
            );
          } catch (error) {
            const info = sanitizeError(error);
            log.warn('Failed to persist coherence edits', {
              operation: 'updateEntryOutput',
              error: info.message,
              errorName: info.name,
              promptUuid: currentPromptUuid,
              promptDocId: currentPromptDocId ?? null,
            });
          }
        }

        setReviewData(null);
      } finally {
        setIsApplying(false);
      }
    },
    [
      applyInitialHighlightSnapshot,
      currentPromptDocId,
      currentPromptUuid,
      handleDisplayedPromptChange,
      latestHighlightRef,
      promptHistory,
      promptOptimizer.displayedPrompt,
      reviewData,
      toast,
    ]
  );

  const dismissReview = useCallback((): void => {
    setReviewData(null);
  }, []);

  return {
    reviewData,
    isChecking,
    isApplying,
    runCoherenceCheck,
    applyRecommendations,
    dismissReview,
  };
}
