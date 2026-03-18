import { useCallback } from 'react';
import type { PromptCanvasProps } from '../types';

type CanvasCoherenceParams = Pick<
  PromptCanvasProps,
  | 'coherenceIssues'
  | 'isCoherenceChecking'
  | 'isCoherencePanelExpanded'
  | 'onToggleCoherencePanelExpanded'
  | 'onDismissCoherenceIssue'
  | 'onDismissAllCoherenceIssues'
  | 'onApplyCoherenceFix'
  | 'onScrollToCoherenceSpan'
>;

export function useCanvasCoherence({
  coherenceIssues,
  isCoherenceChecking,
  isCoherencePanelExpanded,
  onToggleCoherencePanelExpanded,
  onDismissCoherenceIssue,
  onDismissAllCoherenceIssues,
  onApplyCoherenceFix,
  onScrollToCoherenceSpan,
}: CanvasCoherenceParams) {
  const scrollToSpan = useCallback(
    (spanId: string): void => {
      onScrollToCoherenceSpan?.(spanId);
    },
    [onScrollToCoherenceSpan]
  );

  return {
    coherenceIssues,
    isCoherenceChecking,
    isCoherencePanelExpanded,
    onToggleCoherencePanelExpanded,
    onDismissCoherenceIssue,
    onDismissAllCoherenceIssues,
    onApplyCoherenceFix,
    onScrollToCoherenceSpan: scrollToSpan,
  };
}
