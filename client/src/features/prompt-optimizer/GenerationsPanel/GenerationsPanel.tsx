import React, { useCallback, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@promptstudio/system/components/ui/button';
import { Icon, Play } from '@promptstudio/system/components/ui';
import type { Generation, GenerationsPanelProps } from './types';
import { GenerationHeader } from './components/GenerationHeader';
import { GenerationCard } from './components/GenerationCard';
import { useGenerationsState } from './hooks/useGenerationsState';
import { useGenerationActions } from './hooks/useGenerationActions';

type DraftModel = 'flux-kontext' | 'wan-2.2';

const EmptyState = ({
  onRunDraft,
  isRunDraftDisabled,
}: {
  onRunDraft: () => void;
  isRunDraftDisabled: boolean;
}): React.ReactElement => (
  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
    <div className="border-border aspect-video flex w-full max-w-sm flex-col items-center justify-center rounded-lg border border-dashed p-6">
      <Icon
        icon={Play}
        size="xl"
        className="text-muted mb-4"
        aria-hidden="true"
      />
      <div className="text-base font-medium text-foreground mb-3">
        No outputs yet
      </div>
      <div className="text-sm text-muted">
        Run a draft or render to see your outputs here.
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-8 px-3 text-sm font-semibold rounded-md"
        onClick={onRunDraft}
        disabled={isRunDraftDisabled}
      >
        Run Draft
      </Button>
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

  const { generateDraft, generateRender, retryGeneration } =
    useGenerationActions(dispatch, {
      aspectRatio,
      duration,
      fps,
      generationParams,
      promptVersionId,
      generations,
    });

  const activeDraftModel = useMemo(
    () => getLatestByTier('draft')?.model ?? null,
    [getLatestByTier]
  );

  const defaultDraftModel: DraftModel = useMemo(() => {
    if (activeDraftModel === 'flux-kontext' || activeDraftModel === 'wan-2.2') {
      return activeDraftModel;
    }
    return 'flux-kontext';
  }, [activeDraftModel]);

  const handleDraft = useCallback(
    (model: DraftModel) => {
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
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <GenerationHeader
        onDraft={handleDraft}
        onRender={handleRender}
        isDraftDisabled={!prompt.trim() || isGenerating}
        isRenderDisabled={!prompt.trim() || isGenerating}
        activeDraftModel={activeDraftModel}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {generations.length === 0 ? (
          <EmptyState
            onRunDraft={() => handleDraft(defaultDraftModel)}
            isRunDraftDisabled={!prompt.trim() || isGenerating}
          />
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
    </div>
  );
}
