import React, { memo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@components/Button';
import type { PromptHistoryEntry } from '@hooks/types';

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
      <li>
        <div className="group w-full rounded-geist-lg p-geist-3 bg-red-50 border border-red-200">
          <p className="text-label-12 text-red-900 mb-geist-2">Delete this prompt?</p>
          <div className="flex gap-geist-2">
            <Button
              onClick={handleDelete}
              size="small"
              variant="primary"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
            <Button
              onClick={handleCancel}
              size="small"
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
        className={`group relative w-full rounded-[8px] transition-colors ${
          isSelected ? 'bg-[rgba(139,92,246,0.08)]' : 'bg-transparent hover:bg-[rgba(0,0,0,0.04)]'
        }`}
        data-external-hover={isHovering ? 'true' : 'false'}
      >
        <span
          className={`absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-full transition-opacity ${
            showAccentBar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{ backgroundColor: stageColor }}
          aria-hidden="true"
        />
        <button
          onClick={handleLoad}
          className="w-full h-12 text-left flex items-center rounded-[8px] cursor-pointer"
          style={{ paddingLeft: 12, paddingRight: 10 }}
          aria-label={`Load prompt: ${title}`}
          title={title}
        >
          <div className="flex items-center gap-3 w-full">
            <span
              className="h-[6px] w-[6px] rounded-full flex-shrink-0"
              style={{ backgroundColor: stageColor }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <p 
                className="text-[13px] font-medium leading-tight text-[#111827]"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  opacity: isProcessing ? 0.6 : 1,
                }}
                title={title}
              >
                {title}
              </p>
              {isProcessing ? (
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#6B7280]">
                  <span className="truncate">{processingLabel}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    className="animate-spin"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke={stageColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="42"
                      strokeDashoffset="14"
                    />
                  </svg>
                </div>
              ) : (
                <div
                  className="mt-0.5 text-[12px] text-[#6B7280]"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: isSelected ? 1 : 1,
                  }}
                  title={meta}
                >
                  {meta}
                </div>
              )}
            </div>
          </div>
        </button>

        {stage === 'error' && (
          <button
            onClick={handleRetry}
            className="absolute right-[36px] top-[9px] px-2 py-1 opacity-0 group-hover:opacity-100 rounded-[6px] hover:bg-[rgba(0,0,0,0.04)] transition-all flex items-center gap-1"
            aria-label="Retry"
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" style={{ color: stageColor }} />
            <span className="text-[12px] text-[#111827]">Retry</span>
          </button>
        )}

        {/* Delete button - shows on hover */}
        <button
          onClick={handleDelete}
          className="absolute right-geist-2 top-geist-2 p-geist-2 opacity-0 group-hover:opacity-100 rounded-geist hover:bg-red-50 transition-all"
          aria-label="Delete prompt"
          title="Delete prompt"
        >
          <Trash2 className="h-3.5 w-3.5 text-geist-accents-4 hover:text-red-600" />
        </button>
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
    prevProps.processingLabel === nextProps.processingLabel;
});

HistoryItem.displayName = 'HistoryItem';
