import React from 'react';
import { cn } from '@/utils/cn';

interface CoherenceSpanMarkerProps {
  hasIssue: boolean;
  issueType?: 'conflict' | 'harmonization';
  children: React.ReactNode;
}

/**
 * Wraps span content with visual indicator when a coherence issue exists.
 */
export function CoherenceSpanMarker({
  hasIssue,
  issueType = 'harmonization',
  children,
}: CoherenceSpanMarkerProps) {
  if (!hasIssue) {
    return <>{children}</>;
  }

  return (
    <span
      className={cn(
        'relative',
        issueType === 'conflict'
          ? 'underline decoration-error decoration-wavy decoration-2 underline-offset-4'
          : 'underline decoration-warning decoration-dotted decoration-2 underline-offset-4'
      )}
    >
      {children}
      <span
        className={cn(
          'absolute -right-1 -top-1 h-2 w-2 rounded-full',
          issueType === 'conflict' ? 'bg-error' : 'bg-warning'
        )}
      />
    </span>
  );
}
