import React from 'react';
import type { ContinuityShot } from '../../types';
import { ShotCard } from './ShotCard';

interface SessionTimelineProps {
  shots: ContinuityShot[];
  selectedShotId?: string | null;
  onSelectShot?: (shotId: string) => void;
  onGenerateShot?: (shotId: string) => void;
  onViewAsset?: (assetId: string) => void;
}

export function SessionTimeline({
  shots,
  selectedShotId,
  onSelectShot,
  onGenerateShot,
  onViewAsset,
}: SessionTimelineProps): React.ReactElement {
  if (!shots.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
        No shots yet. Add one to start the continuity timeline.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shots.map((shot) => (
        <ShotCard
          key={shot.id}
          shot={shot}
          isSelected={selectedShotId === shot.id}
          onSelect={onSelectShot}
          onGenerate={onGenerateShot}
          onView={onViewAsset}
        />
      ))}
    </div>
  );
}

export default SessionTimeline;
