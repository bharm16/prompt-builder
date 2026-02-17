import { useCallback } from 'react';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import { applyGenerationReuse } from '@features/prompt-optimizer/PromptCanvas/utils/reuseGeneration';
import { usePromptCanvasPanelProps } from '@features/prompt-optimizer/PromptCanvas/hooks/usePromptCanvasPanelProps';
import { useShotGenerations } from '@features/prompt-optimizer/PromptCanvas/hooks/useShotGenerations';
import { useVersionManagement } from '@features/prompt-optimizer/PromptCanvas/hooks/useVersionManagement';

interface CanvasGenerationsParams {
  [key: string]: any;
}

export function useCanvasGenerations(params: CanvasGenerationsParams) {
  const { shotId, shotPromptEntry, updateShotVersions } = useShotGenerations({
    currentShot: params.currentShot,
    updateShot: params.updateShot,
  });

  const versioning = useVersionManagement({
    hasShotContext: params.hasShotContext,
    shotId,
    shotPromptEntry,
    updateShotVersions,
    promptHistory: params.promptHistory,
    currentPromptUuid: params.currentPromptUuid,
    currentPromptDocId: params.currentPromptDocId,
    setCurrentPromptUuid: params.setCurrentPromptUuid,
    setCurrentPromptDocId: params.setCurrentPromptDocId,
    activeVersionId: params.activeVersionId,
    setActiveVersionId: params.setActiveVersionId,
    inputPrompt: params.inputPrompt,
    normalizedDisplayedPrompt: params.normalizedDisplayedPrompt,
    selectedMode: params.selectedMode,
    selectedModel: params.selectedModel,
    generationParams: params.generationParams,
    serializedKeyframes: params.serializedKeyframes,
    promptOptimizer: params.promptOptimizer,
    applyInitialHighlightSnapshot: params.applyInitialHighlightSnapshot,
    resetEditStacks: params.resetEditStacks,
    setDisplayedPromptSilently: params.setDisplayedPromptSilently,
    latestHighlightRef: params.latestHighlightRef,
    versionEditCountRef: params.versionEditCountRef,
    versionEditsRef: params.versionEditsRef,
    resetVersionEdits: params.resetVersionEdits,
    effectiveAspectRatio: params.effectiveAspectRatio,
  });

  const handleReuseGeneration = useCallback(
    (generation: Generation): void => {
      applyGenerationReuse(generation, {
        onInputPromptChange: params.onInputPromptChange,
        onResetResultsForEditing: params.onResetResultsForEditing,
        setSelectedModel: params.setSelectedModel,
        setVideoTier: params.setVideoTier,
        setGenerationParams: params.setGenerationParams,
      });
    },
    [params]
  );

  const handleToggleGenerationFavorite = useCallback(
    (generationId: string, isFavorite: boolean): void => {
      versioning.setGenerationFavorite(generationId, isFavorite);
    },
    [versioning]
  );

  const { versionsPanelProps, generationsPanelProps } = usePromptCanvasPanelProps({
    versionsForPanel: versioning.versionsForPanel,
    selectedVersionId: versioning.selectedVersionId,
    onSelectVersion: versioning.handleSelectVersion,
    onCreateVersion: versioning.handleCreateVersion,
    showResults: params.showResults,
    normalizedDisplayedPrompt: params.normalizedDisplayedPrompt,
    normalizedInputPrompt: params.normalizedInputPrompt,
    promptVersionId: versioning.promptVersionId,
    effectiveAspectRatio: params.effectiveAspectRatio,
    durationSeconds: params.durationSeconds,
    fpsNumber: params.fpsNumber,
    generationParams: params.generationParams,
    initialGenerations: versioning.activeVersion?.generations ?? undefined,
    onGenerationsChange: versioning.handleGenerationsChange,
    currentVersions: versioning.currentVersions,
    onRestoreVersion: versioning.handleSelectVersion,
    onCreateVersionIfNeeded: versioning.createVersionIfNeeded,
  });

  return {
    ...versioning,
    versionsPanelProps,
    generationsPanelProps,
    handleReuseGeneration,
    handleToggleGenerationFavorite,
  };
}
