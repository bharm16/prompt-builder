import React, { useCallback, useMemo } from 'react';
import { Panel } from '@promptstudio/system/components/system/Panel';
import { cn } from '@/utils/cn';
import type { Generation, GenerationsPanelProps } from './types';
import { GenerationHeader } from './components/GenerationHeader';
import { GenerationCard } from './components/GenerationCard';
import { useGenerationsState } from './hooks/useGenerationsState';
import { useGenerationActions } from './hooks/useGenerationActions';

const EmptyState = (): React.ReactElement => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-1 px-6 py-12 text-center">
    <div className="text-body-sm font-semibold text-foreground">No generations yet</div>
    <div className="text-label-sm text-muted">
      Run a draft or render to see your outputs here.
    </div>
  </div>
);

export function GenerationsPanel({
  prompt,
  promptVersionId,
  aspectRatio,
  duration,
  fps,
  generationParams,
  initialGenerations,
  onGenerationsChange,
  className,
}: GenerationsPanelProps): React.ReactElement {
  const {
    generations,
    activeGenerationId,
    isGenerating,
    dispatch,
    getLatestByTier,
    removeGeneration,
  } = useGenerationsState({ initialGenerations, onGenerationsChange });

  const { generateDraft, generateRender, retryGeneration } = useGenerationActions(dispatch, {
    aspectRatio,
    duration,
    fps,
    generationParams,
    promptVersionId,
    generations,
  });

  const activeDraftModel = useMemo(() => getLatestByTier('draft')?.model ?? null, [
    getLatestByTier,
  ]);

  const handleDraft = useCallback(
    (model: 'flux-kontext' | 'wan-2.2') => {
      if (!prompt.trim()) return;
      generateDraft(model, prompt, {});
    },
    [generateDraft, prompt]
  );

  const handleRender = useCallback(
    (model: string) => {
      if (!prompt.trim()) return;
      generateRender(model, prompt, {});
    },
    [generateRender, prompt]
  );

  const handleDelete = useCallback(
    (generation: Generation) => {
      removeGeneration(generation.id);
    },
    [removeGeneration]
  );

  const handleRetry = useCallback(
    (generation: Generation) => {
      retryGeneration(generation.id);
    },
    [retryGeneration]
  );

  const handleDownload = useCallback((generation: Generation) => {
    const url = generation.mediaUrls[0];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <Panel className={cn('flex h-full flex-col overflow-hidden', className)}>
      <GenerationHeader
        onDraft={handleDraft}
        onRender={handleRender}
        isDraftDisabled={!prompt.trim() || isGenerating}
        isRenderDisabled={!prompt.trim() || isGenerating}
        activeDraftModel={activeDraftModel}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {generations.length === 0 ? (
          <EmptyState />
        ) : (
          generations.map((generation) => (
            <GenerationCard
              key={generation.id}
              generation={generation}
              isActive={generation.id === activeGenerationId}
              onRetry={handleRetry}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))
        )}
      </div>
    </Panel>
  );
}
