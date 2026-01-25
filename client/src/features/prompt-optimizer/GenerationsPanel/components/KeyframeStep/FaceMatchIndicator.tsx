import React from 'react';
import { cn } from '@/utils/cn';

interface FaceMatchIndicatorProps {
  score?: number | undefined;
}

export function FaceMatchIndicator({ score }: FaceMatchIndicatorProps): React.ReactElement {
  if (score === undefined || score === null) {
    return <span className="text-xs text-white/70">Face match: --</span>;
  }

  const percentage = Math.round(score * 100);
  const colorClass =
    score >= 0.8 ? 'text-emerald-400' : score >= 0.6 ? 'text-amber-400' : 'text-red-400';
  const barClass =
    score >= 0.8 ? 'bg-emerald-400' : score >= 0.6 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-xs font-semibold', colorClass)}>{percentage}% match</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default FaceMatchIndicator;
