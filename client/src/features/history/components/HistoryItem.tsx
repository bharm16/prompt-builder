import React, { memo } from 'react';
import { Copy, CopyPlus, ExternalLink, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@promptstudio/system/components/ui/dropdown-menu';
import type { PromptHistoryEntry } from '@hooks/types';
import { HistoryThumbnail } from './HistoryThumbnail';
import { cn } from '@/utils/cn';

type PromptRowStage = 'draft' | 'optimized' | 'generated' | 'error';

export interface HistoryItemProps {
  entry: PromptHistoryEntry;
  onLoad: (entry: PromptHistoryEntry) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (entry: PromptHistoryEntry) => void;
  onRename?: (entry: PromptHistoryEntry) => void;
  onCopyPrompt?: (entry: PromptHistoryEntry) => void;
  onOpenInNewTab?: (entry: PromptHistoryEntry) => void;
  isSelected?: boolean;
  isExternallyHovered?: boolean;
  title: string;
  meta: string;
  stage: PromptRowStage;
  processingLabel?: string | null;
  thumbnailUrl?: string | null;
  versionLabel?: string;
  dataIndex?: number;
}

/**
 * Memoized history item component with delete functionality
 */
export const HistoryItem = memo<HistoryItemProps>(({
  entry,
  onLoad,
  onDelete,
  onDuplicate,
  onRename,
  onCopyPrompt,
  onOpenInNewTab,
  isSelected = false,
  isExternallyHovered = false,
  title,
  meta,
  stage,
  processingLabel = null,
  thumbnailUrl = null,
  versionLabel,
  dataIndex,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<boolean>(false);
  const [contextOpen, setContextOpen] = React.useState<boolean>(false);
  const contextMenuRef = React.useRef<boolean>(false);

  const statusLabel =
    processingLabel ??
    (stage === 'error' ? 'Failed' : stage === 'draft' ? 'Draft' : null);
  const statusTone = processingLabel ? 'warning' : stage === 'error' ? 'error' : stage === 'draft' ? 'muted' : null;

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

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    contextMenuRef.current = true;
    setContextOpen(true);
  };

  const handleMenuOpenChange = (nextOpen: boolean): void => {
    if (nextOpen && !contextMenuRef.current) return;
    setContextOpen(nextOpen);
    if (!nextOpen) {
      contextMenuRef.current = false;
    }
  };

  const handleMenuAction =
    (action?: (entry: PromptHistoryEntry) => void) => (event: Event) => {
      event.preventDefault();
      action?.(entry);
      setContextOpen(false);
    };

  const handleDeleteFromMenu = (): void => {
    setShowDeleteConfirm(true);
  };

  if (showDeleteConfirm) {
    return (
      <li data-history-index={dataIndex}>
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

  return (
    <DropdownMenu open={contextOpen} onOpenChange={handleMenuOpenChange}>
      <li>
        <div
          className={cn(
            'group relative flex items-center rounded-lg ps-card-glass ps-card-interactive',
            (isSelected || isHovering) && 'bg-surface-2/40'
          )}
          data-stage={stage}
        >
          <span
            className={cn(
              'absolute left-0 top-ps-2 bottom-ps-2 w-0.5 rounded-full bg-accent opacity-0 transition-opacity duration-150',
              showAccentBar && 'opacity-100',
              'group-hover:opacity-100'
            )}
            aria-hidden="true"
          />
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              onClick={handleLoad}
              onContextMenu={handleContextMenu}
              variant="ghost"
              className="flex w-full min-w-0 items-start gap-ps-3 py-ps-3 pl-ps-3 pr-ps-3 text-left"
              aria-label={`Load prompt: ${title}`}
              title={title}
            >
              <div className="ps-thumb-trigger">
                <HistoryThumbnail
                  src={thumbnailUrl}
                  label={title}
                  size="md"
                  variant="muted"
                  isActive={showAccentBar}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-ps-1">
                {versionLabel ? (
                  <span className="text-label-10 font-semibold uppercase tracking-widest text-faint">
                    {versionLabel}
                  </span>
                ) : null}
                <div className="flex items-start justify-between gap-ps-3">
                  <span className="min-w-0 flex-1 ps-line-clamp-2 text-body-sm font-semibold text-foreground">
                    {title}
                  </span>
                  {statusLabel && statusTone ? (
                    <span
                      className={cn(
                        'rounded-full border px-ps-2 py-0.5 text-label-sm',
                        statusTone === 'warning' && 'border-warning/40 bg-warning/10 text-warning',
                        statusTone === 'error' && 'border-error/40 bg-error/10 text-error',
                        statusTone === 'muted' && 'border-border bg-surface-2 text-muted'
                      )}
                    >
                      {statusLabel}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-meta text-muted">{meta}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>

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
              <RotateCcw className="h-3.5 w-3.5 text-warning" />
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

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="ps-glass-card border-border/60 text-foreground"
      >
        <DropdownMenuItem onSelect={handleMenuAction(onDuplicate)} disabled={!onDuplicate}>
          <CopyPlus className="h-4 w-4" aria-hidden="true" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleMenuAction(onRename)} disabled={!onRename}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleMenuAction(onCopyPrompt)} disabled={!onCopyPrompt}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy prompt
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleMenuAction(onOpenInNewTab)}
          disabled={!onOpenInNewTab || !entry.uuid}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleMenuAction(handleDeleteFromMenu)} disabled={!entry.id}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    prevProps.thumbnailUrl === nextProps.thumbnailUrl &&
    prevProps.versionLabel === nextProps.versionLabel;
});

HistoryItem.displayName = 'HistoryItem';
