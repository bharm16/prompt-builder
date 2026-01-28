import React, { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@promptstudio/system/components/ui/select';
import { cn } from '@/utils/cn';
import type { I2VConstraintMode } from '../types/i2v';

interface ConstraintModeSelectorProps {
  mode: I2VConstraintMode;
  onChange: (mode: I2VConstraintMode) => void;
  disabled?: boolean;
  isAnalyzing?: boolean;
  className?: string;
}

const MODE_OPTIONS: Array<{
  id: I2VConstraintMode;
  label: string;
  description: string;
}> = [
  {
    id: 'strict',
    label: 'Strict',
    description: 'Motion only; image visuals stay fixed.',
  },
  {
    id: 'flexible',
    label: 'Flexible',
    description: 'Allow visual edits with warnings.',
  },
  {
    id: 'transform',
    label: 'Transform',
    description: 'Full pass-through for style changes.',
  },
];

export function ConstraintModeSelector({
  mode,
  onChange,
  disabled = false,
  isAnalyzing = false,
  className,
}: ConstraintModeSelectorProps): React.ReactElement {
  const activeLabel = useMemo(
    () => MODE_OPTIONS.find((option) => option.id === mode)?.label ?? 'Strict',
    [mode]
  );

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-label-sm text-muted">I2V Mode</span>
      <Select
        value={mode}
        onValueChange={(value) => onChange(value as I2VConstraintMode)}
        disabled={disabled}
      >
        <SelectTrigger
          size="xs"
          variant="ghost"
          className="border-border bg-surface-2 text-label-sm text-foreground min-w-[110px] rounded-md border px-2 py-1"
          aria-label={`I2V mode: ${activeLabel}`}
          title={`I2V mode: ${activeLabel}`}
        >
          {activeLabel}
        </SelectTrigger>
        <SelectContent>
          {MODE_OPTIONS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <div className="flex flex-col text-left">
                <span className="text-body-sm text-foreground">{option.label}</span>
                <span className="text-label-xs text-muted">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAnalyzing && (
        <span className="text-label-xs text-muted">Analyzing image...</span>
      )}
    </div>
  );
}
