import React from 'react';
import { cn } from '@/utils/cn';

interface ScoreBarProps {
  value: number;
  max?: number;
  className?: string;
}

export function ScoreBar({ value, max = 100, className }: ScoreBarProps): React.ReactElement {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={cn('h-2 w-full rounded-full bg-[#2A2B31]', className)}>
      <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${percentage}%` }} />
    </div>
  );
}
