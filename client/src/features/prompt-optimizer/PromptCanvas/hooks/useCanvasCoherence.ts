import { useCallback } from 'react';

interface CanvasCoherenceParams {
  coherenceIssues: any;
  isCoherenceChecking: any;
  isCoherencePanelExpanded: any;
  onToggleCoherencePanelExpanded: any;
  onDismissCoherenceIssue: any;
  onDismissAllCoherenceIssues: any;
  onApplyCoherenceFix: any;
  onScrollToCoherenceSpan: any;
}

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
