import React, { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { Checkbox } from '@promptstudio/system/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@promptstudio/system/components/ui/dialog';
import type { CoherenceFinding, CoherenceRecommendation, CoherenceReviewData } from '../types/coherence';
import './CoherenceReviewModal.css';

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
      <div key={rec.id || rec.title} className="coherence-review-rec">
        <label className="coherence-review-rec__header">
          <Checkbox
            className="coherence-review-rec__checkbox"
            checked={isSelected}
            onCheckedChange={(checked) => setRecommendationSelected(rec.id, Boolean(checked))}
            aria-label={`Select ${rec.title}`}
          />
          <div className="coherence-review-rec__content">
            <div className="coherence-review-rec__title">{rec.title}</div>
            <div className="coherence-review-rec__rationale">{rec.rationale}</div>
          </div>
        </label>
        <Button
          type="button"
          className="coherence-review-rec__preview"
          onClick={() => handleTogglePreview(rec.id)}
          variant="ghost"
        >
          {isExpanded ? 'Hide diff' : 'Preview diff'}
        </Button>
        {isExpanded && (
          <div className="coherence-review-rec__diff">
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
                <div key={`${rec.id || rec.title}-${index}`} className="coherence-review-rec__diff-item">
                  <div className="coherence-review-rec__diff-label">Edit {index + 1}</div>
                  <div className="coherence-review-rec__diff-row">
                    <div className="coherence-review-rec__diff-key">Before</div>
                    <div className="coherence-review-rec__diff-value">{before || '—'}</div>
                  </div>
                  <div className="coherence-review-rec__diff-row">
                    <div className="coherence-review-rec__diff-key">After</div>
                    <div className="coherence-review-rec__diff-value">
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
      <div key={finding.id || finding.message} className={`coherence-review-item coherence-review-item--${kind}`}>
        <div className="coherence-review-item__header">
          <div className="coherence-review-item__title">
            {kind === 'conflict' ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
            <span>{finding.message}</span>
          </div>
          {finding.severity && kind === 'conflict' && (
            <span className={`coherence-review-item__severity coherence-review-item__severity--${finding.severity}`}>
              {finding.severity}
            </span>
          )}
        </div>
        <p className="coherence-review-item__reasoning">{finding.reasoning}</p>
        {spans.length > 0 && (
          <div className="coherence-review-item__spans">
            <div className="coherence-review-item__label">
              {kind === 'conflict' ? 'What conflicts' : 'What aligns'}
            </div>
            <div className="coherence-review-item__span-list">
              {spans.map((span) => (
                <div key={`${finding.id}-${span.label}`} className="coherence-review-item__span">
                  <span className="coherence-review-item__span-label">Span {span.label}</span>
                  <span className="coherence-review-item__span-text">“{span.text || '—'}”</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="coherence-review-item__recommendations">
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
      <DialogContent className="coherence-review-modal po-modal po-modal--xl po-surface po-surface--grad po-animate-pop-in p-0 gap-0 max-w-none [&>button]:hidden">
        <header className="coherence-review-header">
          <div>
            <DialogTitle>Review coherence updates</DialogTitle>
            <p>
              Conflicts require attention. Harmonizations are optional tweaks.
              {isChecking && <span className="coherence-review-header__status">Checking…</span>}
            </p>
          </div>
          <Button
            type="button"
            className="coherence-review-close"
            onClick={onDismiss}
            aria-label="Close coherence review"
            variant="ghost"
            size="icon"
          >
            <X size={18} />
          </Button>
        </header>

        <div className="coherence-review-body">
          <section>
            <div className="coherence-review-section__header">
              <h3>Conflicts (action needed)</h3>
              <span>{conflictRecommendations.length}</span>
            </div>
            {conflictRecommendations.length === 0 ? (
              <div className="coherence-review-empty">No conflicts detected.</div>
            ) : (
              conflictRecommendations.map((finding) =>
                renderFinding(finding, review, 'conflict')
              )
            )}
          </section>

          <section>
            <div className="coherence-review-section__header">
              <h3>Harmonizations (optional)</h3>
              <span>{harmonizationRecommendations.length}</span>
            </div>
            {harmonizationRecommendations.length === 0 ? (
              <div className="coherence-review-empty">No harmonizations suggested.</div>
            ) : (
              harmonizationRecommendations.map((finding) =>
                renderFinding(finding, review, 'harmonization')
              )
            )}
          </section>
        </div>

        <footer className="coherence-review-footer">
          <Button
            type="button"
            className="coherence-review-footer__secondary"
            onClick={onUndoOriginal}
            disabled={isApplying}
            variant="ghost"
          >
            Undo original suggestion
          </Button>
          <div className="coherence-review-footer__actions">
            <Button
              type="button"
              className="coherence-review-footer__secondary"
              onClick={onDismiss}
              disabled={isApplying}
              variant="ghost"
            >
              Dismiss
            </Button>
            <Button
              type="button"
              className="coherence-review-footer__primary"
              onClick={() => onApplySelected(Array.from(selectedIds))}
              disabled={selectedCount === 0 || isApplying}
              variant="ghost"
            >
              Apply selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
