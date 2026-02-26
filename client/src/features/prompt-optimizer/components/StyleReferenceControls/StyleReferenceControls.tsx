import React, { useMemo } from 'react';
import type { ContinuityMode, ContinuityShot } from '@/features/continuity/types';
import { StrengthSlider } from '@/features/continuity/components/StyleReferencePanel/StrengthSlider';
import { cn } from '@/utils/cn';

interface StyleReferenceControlsProps {
  shots: ContinuityShot[];
  currentShot: ContinuityShot | null;
  onStyleReferenceChange: (shotId: string) => void;
  onStrengthChange: (strength: number) => void;
  onModeChange: (mode: ContinuityMode) => void;
}

const MODE_OPTIONS: Array<{ label: string; value: ContinuityMode }> = [
  { label: 'Frame Bridge', value: 'frame-bridge' },
  { label: 'Style Match', value: 'style-match' },
];

const renderShotLabel = (shot: ContinuityShot): string => {
  const prompt = shot.userPrompt?.trim() ?? '';
  const snippet = prompt.length > 30 ? `${prompt.slice(0, 30)}…` : prompt;
  return `Shot ${shot.sequenceIndex + 1}${snippet ? `: ${snippet}` : ''}`;
};

export function StyleReferenceControls({
  shots,
  currentShot,
  onStyleReferenceChange,
  onStrengthChange,
  onModeChange,
}: StyleReferenceControlsProps): React.ReactElement | null {
  const orderedShots = useMemo(
    () => [...shots].sort((a, b) => a.sequenceIndex - b.sequenceIndex),
    [shots]
  );

  if (!currentShot) return null;

  const previousShots = orderedShots.filter((shot) => shot.sequenceIndex < currentShot.sequenceIndex);
  if (previousShots.length === 0) return null;

  const defaultReferenceId = previousShots[previousShots.length - 1]?.id ?? null;
  const selectedReferenceId = currentShot.styleReferenceId ?? defaultReferenceId ?? '';
  const resolvedMode: ContinuityMode = currentShot.continuityMode ?? 'frame-bridge';

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Style Reference
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted">Source shot</label>
        <select
          value={selectedReferenceId}
          onChange={(event) => onStyleReferenceChange(event.target.value)}
          className="w-full rounded-md border border-border bg-surface-1 px-2 py-2 text-sm text-foreground"
        >
          {previousShots.map((shot) => (
            <option key={shot.id} value={shot.id}>
              {renderShotLabel(shot)}
            </option>
          ))}
        </select>
      </div>

      <StrengthSlider
        value={currentShot.styleStrength ?? 0.6}
        onChange={onStrengthChange}
      />

      <div className="flex gap-2">
        {MODE_OPTIONS.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onModeChange(mode.value)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium',
              resolvedMode === mode.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface-3 text-muted hover:text-foreground'
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default StyleReferenceControls;
