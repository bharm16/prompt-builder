import React, { memo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import type { PromptHistoryEntry } from '@hooks/types';
import { cn } from '@/utils/cn';

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

  const stageColorClass =
    stage === 'generated'
      ? 'bg-success'
      : stage === 'optimized'
        ? 'bg-accent-2'
        : stage === 'error'
          ? 'bg-warning'
          : 'bg-muted';

  const stageIconClass =
    stage === 'generated'
      ? 'text-success'
      : stage === 'optimized'
        ? 'text-accent-2'
        : stage === 'error'
          ? 'text-warning'
          : 'text-muted';

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
      <li>
        <div className="rounded-lg border border-error/40 bg-error/10 p-ps-4">
          <p className="mb-ps-3 text-body text-foreground">Delete this session?</p>
          <div className="flex gap-ps-3">
            <Button
              onClick={handleDelete}
              size="sm"
              variant="destructive"
              className="flex-1"
            >
              Delete
            </Button>
            <Button
              onClick={handleCancel}
              size="sm"
              variant="secondary"
              className="flex-1"
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
        className={cn(
          'group relative flex items-center rounded-md border border-border/40 bg-transparent transition-all duration-150',
          'hover:-translate-y-px hover:border-border-strong hover:bg-surface-2/60',
          isSelected && 'border-accent-2/40 bg-accent-2/10 shadow-sm'
        )}
        data-stage={stage}
      >
        <span
          className={cn(
            'absolute left-ps-2 top-ps-2 bottom-ps-2 w-1 rounded-full opacity-0 transition-opacity duration-150',
            stageColorClass,
            showAccentBar && 'opacity-100',
            'group-hover:opacity-100'
          )}
          aria-hidden="true"
        />
        <Button
          type="button"
          onClick={handleLoad}
          variant="ghost"
          className="flex w-full min-w-0 items-center gap-ps-3 py-ps-3 pl-ps-4 pr-ps-3 text-left"
          aria-label={`Load prompt: ${title}`}
          title={title}
        >
          <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', stageColorClass)} />
          <div className="flex min-w-0 flex-1 flex-col gap-ps-1">
            <div className="flex items-center justify-between gap-ps-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-ps-2">
                  {versionLabel ? (
                    <span className="flex-shrink-0 text-label-sm font-semibold uppercase tracking-widest text-faint">
                      {versionLabel}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate text-body-lg font-semibold text-foreground">{title}</span>
                </div>
              </div>
              {processingLabel ? (
                <span
                  className="rounded-full border border-accent/50 bg-surface-2 px-ps-2 py-0.5 text-label uppercase tracking-widest text-foreground"
                  data-state="processing"
                >
                  {processingLabel}
                </span>
              ) : (
                <span
                  className="rounded-full border border-border bg-surface-2 px-ps-2 py-0.5 text-label uppercase tracking-widest text-muted"
                  data-state={stage}
                >
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
            <div className="truncate text-body-lg text-muted">{processingLabel ?? meta}</div>
          </div>
        </Button>

        {stage === 'error' && (
          <Button
            type="button"
            onClick={handleRetry}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border border-border bg-surface-1 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            aria-label="Retry"
            title="Retry"
          >
            <RotateCcw className={cn('h-3.5 w-3.5', stageIconClass)} />
          </Button>
        )}

        <Button
          type="button"
          onClick={handleDelete}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md border border-border bg-surface-1 text-faint opacity-0 transition-opacity duration-150 hover:border-error/60 hover:text-error group-hover:opacity-100"
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
