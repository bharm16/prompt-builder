import React, { memo } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@components/Button';
import type { PromptHistoryEntry } from '@hooks/types';
import type { Mode } from '../../prompt-optimizer/context/types';

export interface HistoryItemProps {
  entry: PromptHistoryEntry;
  modes: Mode[];
  onLoad: (entry: PromptHistoryEntry) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
}

/**
 * Memoized history item component with delete functionality
 */
export const HistoryItem = memo<HistoryItemProps>(({ entry, modes, onLoad, onDelete, isSelected = false }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<boolean>(false);
  const modeInfo = modes.find((m) => m.id === entry.mode);
  const ModeIcon: LucideIcon = modeInfo?.icon || FileText;

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

  return (
    <li>
      <div 
        className={`group relative w-full rounded-geist-lg transition-colors ${
          isSelected 
            ? 'bg-geist-background shadow-geist-medium' 
            : 'hover:bg-geist-accents-1'
        }`}
      >
        <button
          onClick={handleLoad}
          className="w-full p-geist-3 text-left"
          aria-label={`Load prompt: ${entry.input.substring(0, 50)}...`}
          title={typeof entry.input === 'string' ? entry.input : undefined}
        >
          <div className="flex items-start gap-geist-3">
            <ModeIcon
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-geist-accents-4"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <p 
                className="text-label-12 text-geist-foreground leading-relaxed"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  /* Two-line clamp without relying on tailwind line-clamp plugin */
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  whiteSpace: 'normal',
                  width: '100%',
                }}
                title={typeof entry.input === 'string' ? entry.input : undefined}
              >
                {entry.input}
              </p>
              <div className="mt-geist-1 flex items-center gap-geist-2 text-label-12 text-geist-accents-5">
                <time dateTime={entry.timestamp || ''}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                </time>
              </div>
            </div>
          </div>
        </button>
        
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
    prevProps.isSelected === nextProps.isSelected;
});

HistoryItem.displayName = 'HistoryItem';
