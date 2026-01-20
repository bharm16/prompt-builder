import { useCallback, useMemo, useState } from 'react';
import { checkPromptCoherence } from '@features/prompt-optimizer/api/coherenceCheckApi';
import type {
  CoherenceCheckRequest,
  CoherenceFinding,
  CoherenceRecommendation,
  CoherenceSpan,
} from '@features/prompt-optimizer/types/coherence';

export interface CoherenceIssue {
  id: string;
  type: 'conflict' | 'harmonization';
  severity: 'low' | 'medium' | 'high';
  message: string;
  reasoning: string;
  involvedSpanIds: string[];
  recommendations: CoherenceRecommendation[];
  spans: CoherenceSpan[];
  dismissed: boolean;
}

interface UseCoherenceAnnotationsParams {
  onApplyFix: (recommendation: CoherenceRecommendation, issue: CoherenceIssue) => boolean | Promise<boolean>;
  toast: { info: (msg: string) => void; success: (msg: string) => void };
}

const resolveConflictSeverity = (
  severity: CoherenceFinding['severity'] | undefined
): 'low' | 'medium' | 'high' => {
  if (severity === 'low' || severity === 'medium' || severity === 'high') {
    return severity;
  }
  return 'medium';
};

export function useCoherenceAnnotations({ onApplyFix, toast }: UseCoherenceAnnotationsParams) {
  const [issues, setIssues] = useState<CoherenceIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  const activeIssues = useMemo(
    () => issues.filter((issue) => !issue.dismissed),
    [issues]
  );

  const affectedSpanIds = useMemo(() => {
    const ids = new Set<string>();
    activeIssues.forEach((issue) => {
      issue.involvedSpanIds.forEach((spanId) => {
        if (spanId) {
          ids.add(spanId);
        }
      });
    });
    return ids;
  }, [activeIssues]);

  const spanIssueMap = useMemo(() => {
    const map = new Map<string, 'conflict' | 'harmonization'>();
    activeIssues.forEach((issue) => {
      issue.involvedSpanIds.forEach((spanId) => {
        if (!spanId) return;
        if (issue.type === 'conflict' || !map.has(spanId)) {
          map.set(spanId, issue.type);
        }
      });
    });
    return map;
  }, [activeIssues]);

  const activeIssueCount = activeIssues.length;
  const conflictCount = useMemo(
    () => activeIssues.filter((issue) => issue.type === 'conflict').length,
    [activeIssues]
  );

  const runCheck = useCallback(
    async (payload: CoherenceCheckRequest) => {
      if (!payload?.beforePrompt || !payload?.afterPrompt) return;

      const spans = Array.isArray(payload.spans) ? payload.spans : [];
      if (!spans.length) return;

      setIsChecking(true);

      try {
        const result = await checkPromptCoherence(payload);
        const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
        const harmonizations = Array.isArray(result.harmonizations)
          ? result.harmonizations
          : [];
        const timestamp = Date.now();

        const newIssues: CoherenceIssue[] = [
          ...conflicts.map((finding, index) => ({
            id: finding.id ?? `conflict_${timestamp}_${index}`,
            type: 'conflict',
            severity: resolveConflictSeverity(finding.severity),
            message: finding.message,
            reasoning: finding.reasoning,
            involvedSpanIds: (finding.involvedSpanIds ?? []).filter(
              (spanId): spanId is string => Boolean(spanId)
            ),
            recommendations: finding.recommendations ?? [],
            spans,
            dismissed: false,
          })),
          ...harmonizations.map((finding, index) => ({
            id: finding.id ?? `harmonization_${timestamp}_${index}`,
            type: 'harmonization',
            severity: 'low',
            message: finding.message,
            reasoning: finding.reasoning,
            involvedSpanIds: (finding.involvedSpanIds ?? []).filter(
              (spanId): spanId is string => Boolean(spanId)
            ),
            recommendations: finding.recommendations ?? [],
            spans,
            dismissed: false,
          })),
        ];

        if (newIssues.length > 0) {
          setIssues((prev) => [...prev, ...newIssues]);
          if (newIssues.some((issue) => issue.type === 'conflict')) {
            setIsPanelExpanded(true);
          }
          toast.info(
            `${newIssues.length} coherence issue${newIssues.length > 1 ? 's' : ''} detected`
          );
        }
      } catch (err) {
        console.warn('Coherence check failed:', err);
      } finally {
        setIsChecking(false);
      }
    },
    [toast]
  );

  const dismissIssue = useCallback((issueId: string) => {
    setIssues((prev) => prev.map((issue) => (
      issue.id === issueId ? { ...issue, dismissed: true } : issue
    )));
  }, []);

  const dismissAll = useCallback(() => {
    setIssues((prev) => prev.map((issue) => ({ ...issue, dismissed: true })));
    setIsPanelExpanded(false);
  }, []);

  const applyFix = useCallback(
    async (issueId: string, recommendation: CoherenceRecommendation) => {
      const issue = issues.find((candidate) => candidate.id === issueId);
      if (!issue) return;

      let applied = false;
      try {
        applied = await onApplyFix(recommendation, issue);
      } catch (error) {
        console.warn('Failed to apply coherence fix:', error);
      }
      if (!applied) {
        toast.info('Fix could not be applied');
        return;
      }

      dismissIssue(issueId);
      toast.success('Fix applied');
    },
    [dismissIssue, issues, onApplyFix, toast]
  );

  const clearResolved = useCallback(() => {
    setIssues((prev) => prev.filter((issue) => !issue.dismissed));
  }, []);

  return {
    issues: activeIssues,
    allIssues: issues,
    isChecking,
    isPanelExpanded,
    setIsPanelExpanded,
    affectedSpanIds,
    spanIssueMap,
    activeIssueCount,
    conflictCount,
    runCheck,
    dismissIssue,
    dismissAll,
    applyFix,
    clearResolved,
  };
}
