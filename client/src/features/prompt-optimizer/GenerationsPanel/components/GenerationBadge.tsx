import React from 'react';
import { Badge } from '@promptstudio/system/components/ui/badge';
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
        className={cn('h-2 w-2 rounded-full', isDraft ? 'bg-muted' : 'bg-accent')}
        aria-hidden="true"
      />
      {isDraft ? 'Draft' : 'Render'}
    </Badge>
  );
}
