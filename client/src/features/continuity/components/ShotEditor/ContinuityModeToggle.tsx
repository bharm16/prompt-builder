import React from 'react';
import type { ContinuityMode } from '../../types';

interface ContinuityModeToggleProps {
  value: ContinuityMode;
  onChange: (value: ContinuityMode) => void;
  disabled?: boolean;
}

const MODES: Array<{ label: string; value: ContinuityMode; description: string }> = [
  { label: 'Frame bridge', value: 'frame-bridge', description: 'Same angle, direct continuation' },
  { label: 'Style match', value: 'style-match', description: 'New angle, style keyframe' },
];

export function ContinuityModeToggle({
  value,
  onChange,
  disabled = false,
}: ContinuityModeToggleProps): React.ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode.value)}
          className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            value === mode.value
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border text-muted hover:text-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="font-medium">{mode.label}</div>
          <div className="text-xs text-muted">{mode.description}</div>
        </button>
      ))}
    </div>
  );
}

export default ContinuityModeToggle;
