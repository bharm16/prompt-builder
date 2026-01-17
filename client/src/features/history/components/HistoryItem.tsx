import React, { memo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import type { PromptHistoryEntry } from '@hooks/types';
import './HistoryItem.css';

type PromptRowStage = 'draft' | 'optimized' | 'generated' | 'error';

export interface HistoryItemProps {
  entry: PromptHistoryEntry;
  onLoad: (entry: PromptHistoryEntry) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  isExternallyHovered?: boolean;
  title: string;
  meta: string;
  stage: PromptRowStage;
  processingLabel?: string | null;
  versionLabel?: string;
}

/**
 * Memoized history item component with delete functionality
 */
export const HistoryItem = memo<HistoryItemProps>(({
  entry,
  onLoad,
  onDelete,
  isSelected = false,
  isExternallyHovered = false,
  title,
  meta,
  stage,
  processingLabel = null,
  versionLabel,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<boolean>(false);

  const stageColor =
    stage === 'generated'
      ? '#22C55E'
      : stage === 'optimized'
        ? '#8B5CF6'
        : stage === 'error'
          ? '#F59E0B'
          : '#A1A1AA';

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (showDeleteConfirm) {
      // Confirmed - actually delete
      if (entry.id) {
        onDelete(entry.id);
      }
      setShowDeleteConfirm(false);
    } else {
      // Show confirmation
      setShowDeleteConfirm(true);
    }
  };

  const handleCancel = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleLoad = (): void => {
    if (!showDeleteConfirm) {
      onLoad(entry);
    }
  };

  const handleRetry = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onLoad(entry);
  };

  if (showDeleteConfirm) {
    return (
      <li className="po-session-delete">
        <div className="po-session-delete__card">
          <p>Delete this session?</p>
          <div className="po-session-delete__actions">
            <Button
              onClick={handleDelete}
              size="sm"
              variant="destructive"
              className="po-session-delete__btn po-session-delete__btn--danger"
            >
              Delete
            </Button>
            <Button
              onClick={handleCancel}
              size="sm"
              variant="secondary"
              className="po-session-delete__btn"
            >
              Cancel
            </Button>
          </div>
        </div>
      </li>
    );
  }

  const isHovering = isExternallyHovered;
  const showAccentBar = isSelected || isHovering;
  const isProcessing = Boolean(processingLabel);

  return (
    <li>
      <div
        className={`po-session-item${isSelected ? ' is-selected' : ''}${isHovering ? ' is-hovered' : ''}`}
        data-stage={stage}
      >
        <span
          className={`po-session-item__accent${showAccentBar ? ' is-visible' : ''}`}
          style={{ backgroundColor: stageColor }}
          aria-hidden="true"
        />
        <Button
          type="button"
          onClick={handleLoad}
          variant="ghost"
          className="po-session-item__button"
          aria-label={`Load prompt: ${title}`}
          title={title}
        >
          <span className="po-session-item__dot" style={{ backgroundColor: stageColor }} />
          <div className="po-session-item__body">
            <div className="po-session-item__row">
              {versionLabel ? <span className="po-session-item__version">{versionLabel}</span> : <span />}
              {processingLabel ? (
                <span className="po-session-item__status" data-state="processing">
                  {processingLabel}
                </span>
              ) : (
                <span className="po-session-item__status" data-state={stage}>
                  {stage === 'generated'
                    ? 'Ready'
                    : stage === 'optimized'
                      ? 'Optimized'
                      : stage === 'draft'
                        ? 'Draft'
                        : 'Failed'}
                </span>
              )}
            </div>
            <div className="po-session-item__meta">{processingLabel ?? meta}</div>
          </div>
        </Button>

        {stage === 'error' && (
          <Button
            type="button"
            onClick={handleRetry}
            variant="ghost"
            size="icon"
            className="po-session-item__retry"
            aria-label="Retry"
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" style={{ color: stageColor }} />
          </Button>
        )}

        <Button
          type="button"
          onClick={handleDelete}
          variant="ghost"
          size="icon"
          className="po-session-item__delete"
          aria-label="Delete prompt"
          title="Delete prompt"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}, (prevProps, nextProps) => {
  return prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.input === nextProps.entry.input &&
    prevProps.entry.score === nextProps.entry.score &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExternallyHovered === nextProps.isExternallyHovered &&
    prevProps.title === nextProps.title &&
    prevProps.meta === nextProps.meta &&
    prevProps.stage === nextProps.stage &&
    prevProps.processingLabel === nextProps.processingLabel &&
    prevProps.versionLabel === nextProps.versionLabel;
});

HistoryItem.displayName = 'HistoryItem';
