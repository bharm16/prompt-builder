import { useMemo } from 'react';
import type { PromptVersionEntry } from '@features/prompt-optimizer/types/domain/prompt-session';
import type { Generation, GenerationsPanelProps } from '@features/prompt-optimizer/GenerationsPanel/types';
import type { VersionsPanelPropsBase } from '../components/PromptCanvasView.types';

interface UsePromptCanvasPanelPropsArgs {
  versionsForPanel: PromptVersionEntry[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onCreateVersion: () => void;
  showResults: boolean;
  normalizedDisplayedPrompt: string | null;
  normalizedInputPrompt: string;
  promptVersionId: string;
  effectiveAspectRatio: string | null;
  durationSeconds: number | null;
  fpsNumber: number | null;
  generationParams: Record<string, unknown> | null | undefined;
  initialGenerations: Generation[] | undefined;
  onGenerationsChange: (generations: Generation[]) => void;
  currentVersions: PromptVersionEntry[];
  onRestoreVersion: (versionId: string) => void;
  onCreateVersionIfNeeded: () => string;
}

interface UsePromptCanvasPanelPropsResult {
  versionsPanelProps: VersionsPanelPropsBase;
  generationsPanelProps: GenerationsPanelProps;
}

export function usePromptCanvasPanelProps({
  versionsForPanel,
  selectedVersionId,
  onSelectVersion,
  onCreateVersion,
  showResults,
  normalizedDisplayedPrompt,
  normalizedInputPrompt,
  promptVersionId,
  effectiveAspectRatio,
  durationSeconds,
  fpsNumber,
  generationParams,
  initialGenerations,
  onGenerationsChange,
  currentVersions,
  onRestoreVersion,
  onCreateVersionIfNeeded,
}: UsePromptCanvasPanelPropsArgs): UsePromptCanvasPanelPropsResult {
  const versionsPanelProps = useMemo<VersionsPanelPropsBase>(
    () => ({
      versions: versionsForPanel,
      selectedVersionId,
      onSelectVersion,
      onCreateVersion,
    }),
    [versionsForPanel, selectedVersionId, onSelectVersion, onCreateVersion]
  );

  const generationsPanelProps = useMemo<GenerationsPanelProps>(
    () => ({
      prompt: showResults ? (normalizedDisplayedPrompt ?? '') : normalizedInputPrompt,
      promptVersionId,
      aspectRatio: effectiveAspectRatio ?? '16:9',
      duration: durationSeconds ?? undefined,
      fps: fpsNumber ?? undefined,
      generationParams: generationParams ?? undefined,
      initialGenerations,
      onGenerationsChange,
      versions: currentVersions,
      onRestoreVersion,
      onCreateVersionIfNeeded,
    }),
    [
      showResults,
      normalizedDisplayedPrompt,
      normalizedInputPrompt,
      promptVersionId,
      effectiveAspectRatio,
      durationSeconds,
      fpsNumber,
      generationParams,
      initialGenerations,
      onGenerationsChange,
      currentVersions,
      onRestoreVersion,
      onCreateVersionIfNeeded,
    ]
  );

  return { versionsPanelProps, generationsPanelProps };
}
