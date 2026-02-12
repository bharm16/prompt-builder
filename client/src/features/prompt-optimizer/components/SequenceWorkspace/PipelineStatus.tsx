import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, WarningCircle } from '@promptstudio/system/components/ui';
import type { ContinuityShot } from '@/features/continuity/types';

interface PipelineStatusProps {
  shot: ContinuityShot | null;
  isGenerating: boolean;
}

const formatElapsed = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const resolveCompletedMessage = (shot: ContinuityShot): string => {
  if (shot.continuityMechanismUsed === 'frame-bridge-keyframe') {
    return 'Connected via frame bridge';
  }

  if (shot.continuityMechanismUsed === 'style-match-keyframe') {
    return 'Style-matched keyframe used';
  }

  return 'Shot generated successfully';
};

export function PipelineStatus({ shot, isGenerating }: PipelineStatusProps): React.ReactElement | null {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);

    const interval = window.setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isGenerating, shot?.id]);

  const elapsedLabel = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds]);

  if (!shot && !isGenerating) {
    return null;
  }

  if (!isGenerating && shot?.status === 'draft') {
    return null;
  }

  if (isGenerating) {
    return (
      <section className="rounded-lg border border-border bg-surface-2 px-3 py-2" data-testid="pipeline-status-generating">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="font-medium">Generating shot...</span>
          <span className="ml-auto text-xs tabular-nums text-muted">{elapsedLabel}</span>
        </div>
      </section>
    );
  }

  if (shot?.status === 'completed') {
    return (
      <section className="rounded-lg border border-success/30 bg-success/10 px-3 py-2" data-testid="pipeline-status-completed">
        <div className="flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" />
          <span className="font-medium">{resolveCompletedMessage(shot)}</span>
        </div>
        {typeof shot.styleScore === 'number' && (
          <p className="mt-1 text-xs text-muted">Style: {Math.round(shot.styleScore)}%</p>
        )}
      </section>
    );
  }

  if (shot?.status === 'failed') {
    return (
      <section className="rounded-lg border border-error/40 bg-error/10 px-3 py-2" data-testid="pipeline-status-failed">
        <div className="flex items-center gap-2 text-sm text-error">
          <WarningCircle className="h-4 w-4" />
          <span className="font-medium">{shot.error || 'Generation failed'}</span>
        </div>
        {shot.styleDegraded && (
          <p className="mt-1 text-xs text-warning">
            {shot.styleDegradedReason || 'Style degraded during generation.'}
          </p>
        )}
      </section>
    );
  }

  return null;
}

export default PipelineStatus;
