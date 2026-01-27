import React from 'react';
import { Icon, Lock } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import type { SuggestionItem } from '../PromptCanvas/types';

interface LockedSpanIndicatorProps {
  reason?: string | null;
  motionAlternatives?: SuggestionItem[] | null;
  onSelectAlternative?: (suggestion: SuggestionItem) => void;
  className?: string;
}

export function LockedSpanIndicator({
  reason,
  motionAlternatives,
  onSelectAlternative,
  className,
}: LockedSpanIndicatorProps): React.ReactElement | null {
  if (!reason) {
    return null;
  }

  const alternatives = Array.isArray(motionAlternatives) ? motionAlternatives : [];

  return (
    <div
      className={cn(
        'border-border bg-surface-3 text-body-sm text-foreground rounded-lg border px-3 py-2',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Icon icon={Lock} size="sm" weight="bold" className="text-muted" />
        <div className="space-y-0.5">
          <div className="text-label-sm text-foreground font-semibold">
            Locked by image
          </div>
          <div className="text-label-sm text-muted">{reason}</div>
        </div>
      </div>
      {alternatives.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {alternatives.map((alt, index) => (
            <button
              key={`${alt.text ?? 'alt'}-${index}`}
              type="button"
              className="border-border bg-surface-2 text-label-sm text-muted hover:bg-surface-1 hover:text-foreground rounded-md border px-2 py-1 transition-colors"
              onClick={() => onSelectAlternative?.(alt)}
            >
              {alt.text ?? 'Motion option'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
