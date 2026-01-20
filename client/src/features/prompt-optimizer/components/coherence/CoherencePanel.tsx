import React from 'react';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  Icon,
  WarningCircle,
  Sparkle,
  CaretUp,
  CaretDown,
} from '@promptstudio/system/components/ui';
import { CoherenceIssueCard } from './CoherenceIssueCard';
import type { CoherenceIssue } from './useCoherenceAnnotations';
import type { CoherenceRecommendation } from '@features/prompt-optimizer/types/coherence';
import { cn } from '@/utils/cn';

interface CoherencePanelProps {
  issues: CoherenceIssue[];
  isChecking: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDismissIssue: (issueId: string) => void;
  onDismissAll: () => void;
  onApplyFix: (issueId: string, recommendation: CoherenceRecommendation) => void;
  onScrollToSpan?: (spanId: string) => void;
}

export function CoherencePanel({
  issues,
  isChecking,
  isExpanded,
  onToggleExpanded,
  onDismissIssue,
  onDismissAll,
  onApplyFix,
  onScrollToSpan,
}: CoherencePanelProps) {
  const conflicts = issues.filter((issue) => issue.type === 'conflict');
  const harmonizations = issues.filter((issue) => issue.type === 'harmonization');
  const hasIssues = issues.length > 0;

  if (!hasIssues && !isChecking) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface-1 shadow-lg transition-all duration-200',
        isExpanded ? 'max-h-[50vh]' : 'max-h-12'
      )}
    >
      <div className="flex w-full items-center justify-between px-4 py-3 hover:bg-surface-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            {isChecking ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-accent" />
            ) : conflicts.length > 0 ? (
              <Icon icon={WarningCircle} size="sm" className="text-error" />
            ) : harmonizations.length > 0 ? (
              <Icon icon={Sparkle} size="sm" className="text-info" />
            ) : null}

            <span className="text-body-sm font-medium text-foreground">
              {isChecking ? (
                'Checking coherence...'
              ) : (
                <>
                  {conflicts.length > 0 && (
                    <span className="text-error">
                      {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {conflicts.length > 0 && harmonizations.length > 0 && ' · '}
                  {harmonizations.length > 0 && (
                    <span className="text-muted">
                      {harmonizations.length} suggestion{harmonizations.length > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          <Icon
            icon={isExpanded ? CaretDown : CaretUp}
            size="sm"
            className="text-muted"
          />
        </button>

        {hasIssues && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismissAll}
            className="ml-2 shrink-0 text-muted hover:text-foreground"
          >
            Dismiss all
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="max-h-[calc(50vh-48px)] overflow-y-auto px-4 pb-4">
          {conflicts.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-2 text-label-12 font-semibold uppercase tracking-widest text-error">
                Conflicts
              </h3>
              <div className="grid gap-2">
                {conflicts.map((issue) => (
                  <CoherenceIssueCard
                    key={issue.id}
                    issue={issue}
                    onDismiss={() => onDismissIssue(issue.id)}
                    onApplyFix={(rec) => onApplyFix(issue.id, rec)}
                    onScrollToSpan={onScrollToSpan}
                  />
                ))}
              </div>
            </section>
          )}

          {harmonizations.length > 0 && (
            <section>
              <h3 className="mb-2 text-label-12 font-semibold uppercase tracking-widest text-muted">
                Suggestions
              </h3>
              <div className="grid gap-2">
                {harmonizations.map((issue) => (
                  <CoherenceIssueCard
                    key={issue.id}
                    issue={issue}
                    onDismiss={() => onDismissIssue(issue.id)}
                    onApplyFix={(rec) => onApplyFix(issue.id, rec)}
                    onScrollToSpan={onScrollToSpan}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
