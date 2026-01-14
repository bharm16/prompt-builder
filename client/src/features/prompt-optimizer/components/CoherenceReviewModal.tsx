import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
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

  const handleToggleSelect = (id?: string): void => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleToggleSelect(rec.id)}
            aria-label={`Select ${rec.title}`}
          />
          <div className="coherence-review-rec__content">
            <div className="coherence-review-rec__title">{rec.title}</div>
            <div className="coherence-review-rec__rationale">{rec.rationale}</div>
          </div>
        </label>
        <button
          type="button"
          className="coherence-review-rec__preview"
          onClick={() => handleTogglePreview(rec.id)}
        >
          {isExpanded ? 'Hide diff' : 'Preview diff'}
        </button>
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

  const modal = (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div className="app-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-content-lg coherence-review-modal">
          <header className="coherence-review-header">
            <div>
              <h2>Review coherence updates</h2>
              <p>
                Conflicts require attention. Harmonizations are optional tweaks.
                {isChecking && <span className="coherence-review-header__status">Checking…</span>}
              </p>
            </div>
            <button
              type="button"
              className="coherence-review-close"
              onClick={onDismiss}
              aria-label="Close coherence review"
            >
              <X size={18} />
            </button>
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
            <button
              type="button"
              className="coherence-review-footer__secondary"
              onClick={onUndoOriginal}
              disabled={isApplying}
            >
              Undo original suggestion
            </button>
            <div className="coherence-review-footer__actions">
              <button
                type="button"
                className="coherence-review-footer__secondary"
                onClick={onDismiss}
                disabled={isApplying}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="coherence-review-footer__primary"
                onClick={() => onApplySelected(Array.from(selectedIds))}
                disabled={selectedCount === 0 || isApplying}
              >
                Apply selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
}
