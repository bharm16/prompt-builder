import React from 'react';
import { Plus } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import type { ContinuityShot } from '@/features/continuity/types';

interface WorkspaceShotTimelineProps {
  shots: ContinuityShot[];
  currentShotId: string | null;
  onShotSelect: (shotId: string) => void;
  onAddShot: () => void;
}

const STATUS_DOT_STYLES: Record<ContinuityShot['status'], string> = {
  draft: 'bg-muted',
  'generating-keyframe': 'bg-accent',
  'generating-video': 'bg-accent',
  completed: 'bg-success',
  failed: 'bg-error',
};

const resolvePromptLabel = (prompt: string | undefined): string => {
  const trimmed = (prompt ?? '').trim();
  if (!trimmed) return 'Untitled shot';
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
};

export function WorkspaceShotTimeline({
  shots,
  currentShotId,
  onShotSelect,
  onAddShot,
}: WorkspaceShotTimelineProps): React.ReactElement | null {
  if (!shots.length) return null;

  const orderedShots = [...shots].sort((a, b) => a.sequenceIndex - b.sequenceIndex);

  return (
    <div className="border-t border-border bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-3 overflow-x-auto">
        {orderedShots.map((shot, index) => {
          const isSelected = currentShotId === shot.id;
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => onShotSelect(shot.id)}
              className={cn(
                'min-w-[140px] rounded-lg border px-3 py-2 text-left transition-colors',
                isSelected
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-surface-2 text-muted hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', STATUS_DOT_STYLES[shot.status])} />
                <span className="text-xs font-semibold">Shot {index + 1}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted truncate">
                {resolvePromptLabel(shot.userPrompt)}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onAddShot}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2 text-muted hover:text-foreground"
          aria-label="Add shot"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default WorkspaceShotTimeline;
