import React from 'react';
import { Badge } from '@promptstudio/system/components/ui/badge';
import { cn } from '@/utils/cn';
import type { GenerationStatus, GenerationTier } from '../types';

interface GenerationBadgeProps {
  tier: GenerationTier;
  status?: GenerationStatus;
  className?: string;
}

export function GenerationBadge({
  tier,
  status,
  className,
}: GenerationBadgeProps): React.ReactElement {
  const isDraft = tier === 'draft';
  const dotClass = (() => {
    if (status === 'pending' || status === 'generating') return 'bg-warning animate-pulse';
    if (status === 'completed') return 'bg-success';
    if (status === 'failed') return 'bg-error';
    return isDraft ? 'bg-muted' : 'bg-accent';
  })();
  return (
    <Badge
      className={cn(
        'gap-1.5 normal-case tracking-normal',
        isDraft
          ? 'border-border bg-surface-2 text-muted'
          : 'border-accent/40 bg-accent/10 text-accent',
        className
      )}
    >
      <span
        className={cn('h-2 w-2 rounded-full', dotClass)}
        aria-hidden="true"
      />
      {isDraft ? 'Draft' : 'Render'}
    </Badge>
  );
}
