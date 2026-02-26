import React from 'react';
import { cn } from '@/utils/cn';
import type { GenerationTier } from '../types';

interface GenerationBadgeProps {
  tier: GenerationTier;
  className?: string;
}

export function GenerationBadge({
  tier,
  className,
}: GenerationBadgeProps): React.ReactElement {
  const isDraft = tier === 'draft';
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-md',
        'bg-black/40',
        isDraft ? 'text-[#4ADE80]/80' : 'text-[#6C5CE7]/80',
        className
      )}
    >
      {isDraft ? 'Draft' : 'Render'}
    </span>
  );
}
