import React, { useState } from 'react';
import { Button } from '@promptstudio/system/components/ui/button';
import { Icon, X, ArrowRight } from '@promptstudio/system/components/ui';
import type { CoherenceIssue } from './useCoherenceAnnotations';
import type { CoherenceRecommendation } from '@features/prompt-optimizer/types/coherence';
import { cn } from '@/utils/cn';

interface CoherenceIssueCardProps {
  issue: CoherenceIssue;
  onDismiss: () => void;
  onApplyFix: (recommendation: CoherenceRecommendation) => void;
  onScrollToSpan?: (spanId: string) => void;
}

export function CoherenceIssueCard({
  issue,
  onDismiss,
  onApplyFix,
  onScrollToSpan,
}: CoherenceIssueCardProps) {
  const [showDiff, setShowDiff] = useState(false);
  const isConflict = issue.type === 'conflict';

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isConflict ? 'border-error/30 bg-error/5' : 'border-border bg-surface-2'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-body-sm font-medium text-foreground">{issue.message}</p>
          <p className="mt-1 text-label-12 text-muted">{issue.reasoning}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-6 w-6 shrink-0 text-muted hover:text-foreground"
        >
          <Icon icon={X} size="sm" />
        </Button>
      </div>

      {issue.involvedSpanIds.length > 0 && onScrollToSpan && (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.involvedSpanIds.map((spanId, idx) => (
            <button
              key={spanId}
              type="button"
              onClick={() => onScrollToSpan(spanId)}
              className="rounded bg-surface-3 px-1.5 py-0.5 text-label-12 text-accent hover:bg-accent/10"
            >
              Span {String.fromCharCode(65 + idx)}
            </button>
          ))}
        </div>
      )}

      {issue.recommendations.length > 0 && (
        <div className="mt-3 grid gap-2">
          {issue.recommendations.map((rec, idx) => (
            <div
              key={rec.id || idx}
              className="flex items-center justify-between gap-2 rounded bg-surface-1 p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-12 font-medium text-foreground">
                  {rec.title}
                </p>
                {showDiff && rec.edits?.[0] && (
                  <div className="mt-1 flex items-center gap-2 text-label-12">
                    <span className="line-through text-muted">
                      {rec.edits[0].anchorQuote?.slice(0, 30)}...
                    </span>
                    <Icon icon={ArrowRight} size="xs" className="text-muted" />
                    <span className="text-accent">
                      {rec.edits[0].replacementText?.slice(0, 30)}...
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  className="text-label-12 text-muted"
                >
                  {showDiff ? 'Hide' : 'Diff'}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApplyFix(rec)}
                  className="text-label-12"
                >
                  Apply
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
