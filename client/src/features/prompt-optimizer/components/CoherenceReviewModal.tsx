import React, { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { Checkbox } from '@promptstudio/system/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@promptstudio/system/components/ui/dialog';
import type { CoherenceFinding, CoherenceRecommendation, CoherenceReviewData } from '../types/coherence';
import { cn } from '@/utils/cn';

interface CoherenceReviewModalProps {
  review: CoherenceReviewData | null;
  isChecking: boolean;
  isApplying: boolean;
  onDismiss: () => void;
  onUndoOriginal: () => void;
  onApplySelected: (recommendationIds: string[]) => Promise<void>;
}

const getSpanText = (
  review: CoherenceReviewData,
  spanId?: string | null,
  anchorQuote?: string | null
): string => {
  if (spanId) {
    const match = review.spans.find((span) => span.id === spanId);
    const text = (match?.quote || match?.text || '').trim();
    if (text) return text;
  }
  return (anchorQuote || '').trim();
};

const buildSpanLabel = (index: number): string =>
  String.fromCharCode('A'.charCodeAt(0) + index);

const summarizeInvolvedSpans = (
  review: CoherenceReviewData,
  finding: CoherenceFinding
): Array<{ label: string; text: string }> => {
  const ids = finding.involvedSpanIds?.filter(Boolean) ?? [];
  if (!ids.length) return [];

  return ids.slice(0, 3).map((id, index) => ({
    label: buildSpanLabel(index),
    text: getSpanText(review, id, null),
  }));
};

export function CoherenceReviewModal({
  review,
  isChecking,
  isApplying,
  onDismiss,
  onUndoOriginal,
  onApplySelected,
}: CoherenceReviewModalProps): React.ReactElement | null {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const conflictRecommendations = review?.conflicts ?? [];
  const harmonizationRecommendations = review?.harmonizations ?? [];

  useEffect(() => {
    if (!review) {
      setSelectedIds(new Set());
      setExpandedIds(new Set());
      return;
    }

    const defaults = new Set<string>();
    review.conflicts.forEach((finding) => {
      finding.recommendations?.forEach((rec) => {
        if (rec.id) {
          defaults.add(rec.id);
        }
      });
    });
    setSelectedIds(defaults);
    setExpandedIds(new Set());
  }, [review]);

  const selectedCount = selectedIds.size;

  const setRecommendationSelected = (id: string | undefined, selected: boolean): void => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleTogglePreview = (id?: string): void => {
    if (!id) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderRecommendation = (
    rec: CoherenceRecommendation,
    reviewData: CoherenceReviewData
  ): React.ReactElement => {
    const isSelected = rec.id ? selectedIds.has(rec.id) : false;
    const isExpanded = rec.id ? expandedIds.has(rec.id) : false;

    return (
      <div key={rec.id || rec.title} className="grid gap-2.5 rounded-md border border-border bg-surface-1 p-3">
        <label className="flex items-start gap-2.5">
          <Checkbox
            className="mt-1"
            checked={isSelected}
            onCheckedChange={(checked) => setRecommendationSelected(rec.id, Boolean(checked))}
            aria-label={`Select ${rec.title}`}
          />
          <div>
            <div className="text-body-sm font-semibold text-foreground">{rec.title}</div>
            <div className="text-label-12 text-muted">{rec.rationale}</div>
          </div>
        </label>
        <Button
          type="button"
          className="w-fit px-0 text-label-12 font-semibold text-accent hover:text-accent-2"
          onClick={() => handleTogglePreview(rec.id)}
          variant="ghost"
        >
          {isExpanded ? 'Hide diff' : 'Preview diff'}
        </Button>
        {isExpanded && (
          <div className="grid gap-3 border-t border-border pt-2.5">
            {rec.edits.map((edit, index) => {
              const before = getSpanText(
                reviewData,
                edit.spanId ?? null,
                edit.anchorQuote ?? null
              );
              const after =
                edit.type === 'replaceSpanText'
                  ? (edit.replacementText || '').trim()
                  : '';
              return (
                <div key={`${rec.id || rec.title}-${index}`} className="grid gap-1.5 text-label-12">
                  <div className="font-semibold text-foreground">Edit {index + 1}</div>
                  <div className="flex gap-2.5">
                    <div className="w-16 text-muted">Before</div>
                    <div className="rounded-md bg-surface-2 px-2 py-1.5 text-foreground">
                      {before || '—'}
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="w-16 text-muted">After</div>
                    <div className="rounded-md bg-surface-2 px-2 py-1.5 text-foreground">
                      {edit.type === 'removeSpan' ? 'Remove span' : after || '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFinding = (
    finding: CoherenceFinding,
    reviewData: CoherenceReviewData,
    kind: 'conflict' | 'harmonization'
  ): React.ReactElement => {
    const spans = summarizeInvolvedSpans(reviewData, finding);
    return (
      <div
        key={finding.id || finding.message}
        className={cn(
          'grid gap-3 rounded-xl border p-4 shadow-sm',
          kind === 'conflict'
            ? 'border-error/30 bg-error/10'
            : 'border-info-200 bg-info-50'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
            {kind === 'conflict' ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
            <span>{finding.message}</span>
          </div>
          {finding.severity && kind === 'conflict' && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-label-sm font-semibold uppercase tracking-widest',
                finding.severity === 'low' && 'bg-warning/10 text-warning',
                finding.severity === 'medium' && 'bg-error/10 text-error',
                finding.severity === 'high' && 'bg-error/20 text-error'
              )}
            >
              {finding.severity}
            </span>
          )}
        </div>
        <p className="text-body-sm text-muted">{finding.reasoning}</p>
        {spans.length > 0 && (
          <div className="grid gap-1.5">
            <div className="text-label-12 font-semibold uppercase tracking-widest text-muted">
              {kind === 'conflict' ? 'What conflicts' : 'What aligns'}
            </div>
            <div className="grid gap-1.5">
              {spans.map((span) => (
                <div key={`${finding.id}-${span.label}`} className="flex flex-wrap gap-1.5 text-body-sm text-foreground">
                  <span className="font-semibold text-foreground">Span {span.label}</span>
                  <span className="text-foreground">“{span.text || '—'}”</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3">
          {finding.recommendations.map((rec) => renderRecommendation(rec, reviewData))}
        </div>
      </div>
    );
  };

  if (!review) {
    return null;
  }

  return (
    <Dialog open={Boolean(review)} onOpenChange={(open) => (!open ? onDismiss() : undefined)}>
      <DialogContent className="w-full max-w-4xl rounded-2xl border border-border bg-surface-1 p-0 shadow-lg [&>button]:hidden">
        <div className="flex flex-col gap-4 p-6 text-foreground">
          <header className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Review coherence updates</DialogTitle>
              <p className="mt-1 text-body-sm text-muted">
                Conflicts require attention. Harmonizations are optional tweaks.
                {isChecking && <span className="ml-2 font-medium text-accent">Checking…</span>}
              </p>
            </div>
            <Button
              type="button"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              onClick={onDismiss}
              aria-label="Close coherence review"
              variant="ghost"
              size="icon"
            >
              <X size={18} />
            </Button>
          </header>

          <div className="grid max-h-screen gap-5 overflow-y-auto pr-1.5">
            <section>
              <div className="mb-3 flex items-center justify-between text-body-sm font-semibold text-foreground">
                <h3>Conflicts (action needed)</h3>
                <span className="rounded-full bg-info-50 px-2 py-0.5 text-label-12 text-accent">
                  {conflictRecommendations.length}
                </span>
              </div>
              {conflictRecommendations.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-2 p-3 text-body-sm text-muted">
                  No conflicts detected.
                </div>
              ) : (
                conflictRecommendations.map((finding) =>
                  renderFinding(finding, review, 'conflict')
                )
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between text-body-sm font-semibold text-foreground">
                <h3>Harmonizations (optional)</h3>
                <span className="rounded-full bg-info-50 px-2 py-0.5 text-label-12 text-accent">
                  {harmonizationRecommendations.length}
                </span>
              </div>
              {harmonizationRecommendations.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-2 p-3 text-body-sm text-muted">
                  No harmonizations suggested.
                </div>
              ) : (
                harmonizationRecommendations.map((finding) =>
                  renderFinding(finding, review, 'harmonization')
                )
              )}
            </section>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <Button
              type="button"
              className="rounded-md border border-border bg-surface-2 px-3 py-2 text-body-sm font-semibold text-foreground hover:bg-surface-3 disabled:opacity-60"
              onClick={onUndoOriginal}
              disabled={isApplying}
              variant="ghost"
            >
              Undo original suggestion
            </Button>
            <div className="flex gap-2.5">
              <Button
                type="button"
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-body-sm font-semibold text-foreground hover:bg-surface-3 disabled:opacity-60"
                onClick={onDismiss}
                disabled={isApplying}
                variant="ghost"
              >
                Dismiss
              </Button>
              <Button
                type="button"
                className="rounded-md border border-transparent bg-foreground px-3 py-2 text-body-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-60"
                onClick={() => onApplySelected(Array.from(selectedIds))}
                disabled={selectedCount === 0 || isApplying}
                variant="ghost"
              >
                Apply selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </Button>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
