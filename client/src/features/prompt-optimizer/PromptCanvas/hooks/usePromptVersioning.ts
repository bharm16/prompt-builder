import { useCallback, useMemo, type MutableRefObject } from 'react';
import { createHighlightSignature } from '@/features/span-highlighting';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptVersionEdit, PromptVersionEntry } from '@hooks/types';
import type { HighlightSnapshot } from '../types';
import type { PromptHistory } from '../../context/types';

interface UsePromptVersioningOptions {
  promptHistory: PromptHistory;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  latestHighlightRef: MutableRefObject<HighlightSnapshot | null>;
  versionEditCountRef: MutableRefObject<number>;
  versionEditsRef: MutableRefObject<PromptVersionEdit[]>;
  resetVersionEdits: () => void;
  effectiveAspectRatio: string | null;
  generationParams: CapabilityValues;
  selectedModel: string;
}

interface UpsertVersionOutputParams {
  action: 'preview' | 'video';
  prompt: string;
  generatedAt: number | string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  aspectRatio?: string | null;
}

interface UsePromptVersioningReturn {
  upsertVersionOutput: (params: UpsertVersionOutputParams) => void;
  syncVersionHighlights: (snapshot: HighlightSnapshot, promptText: string) => void;
}

const toIsoString = (value: number | string): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
    return value;
  }
  return new Date().toISOString();
};

export function usePromptVersioning({
  promptHistory,
  currentPromptUuid,
  currentPromptDocId,
  latestHighlightRef,
  versionEditCountRef,
  versionEditsRef,
  resetVersionEdits,
  effectiveAspectRatio,
  generationParams,
  selectedModel,
}: UsePromptVersioningOptions): UsePromptVersioningReturn {
  const currentPromptEntry = useMemo(() => {
    if (!promptHistory?.history?.length) return null;
    return (
      promptHistory.history.find((entry) => entry.uuid === currentPromptUuid) ||
      promptHistory.history.find((entry) => entry.id === currentPromptDocId) ||
      null
    );
  }, [promptHistory, currentPromptUuid, currentPromptDocId]);

  const currentVersions = useMemo<PromptVersionEntry[]>(
    () => (Array.isArray(currentPromptEntry?.versions) ? currentPromptEntry.versions : []),
    [currentPromptEntry]
  );

  const persistVersions = useCallback(
    (versions: PromptVersionEntry[]): void => {
      if (!currentPromptUuid) return;
      promptHistory.updateEntryVersions(currentPromptUuid, currentPromptDocId, versions);
    },
    [promptHistory, currentPromptUuid, currentPromptDocId]
  );

  const createVersionEntry = useCallback(
    ({
      signature,
      prompt,
      highlights,
      preview,
      video,
    }: {
      signature: string;
      prompt: string;
      highlights?: PromptVersionEntry['highlights'];
      preview?: PromptVersionEntry['preview'];
      video?: PromptVersionEntry['video'];
    }): PromptVersionEntry => {
      const versionNumber = currentVersions.length + 1;
      const editCount = versionEditCountRef.current;
      const edits = versionEditsRef.current.length ? [...versionEditsRef.current] : [];
      return {
        versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: `v${versionNumber}`,
        signature,
        prompt,
        timestamp: new Date().toISOString(),
        highlights: highlights ?? null,
        ...(editCount > 0 ? { editCount } : {}),
        ...(edits.length ? { edits } : {}),
        preview: preview ?? null,
        video: video ?? null,
      };
    },
    [currentVersions.length, versionEditCountRef, versionEditsRef]
  );

  const upsertVersionOutput = useCallback(
    (params: UpsertVersionOutputParams): void => {
      if (!currentPromptUuid) return;
      if (!currentPromptEntry) return;
      const promptText = params.prompt.trim();
      if (!promptText) return;

      const signature = createHighlightSignature(promptText);
      const lastVersion = currentVersions[currentVersions.length - 1] ?? null;
      const hasEditsSinceLastVersion = !lastVersion || lastVersion.signature !== signature;

      const previewPayload =
        params.action === 'preview'
          ? {
              generatedAt: toIsoString(params.generatedAt),
              imageUrl: params.imageUrl ?? null,
              aspectRatio: params.aspectRatio ?? effectiveAspectRatio ?? null,
            }
          : undefined;

      const videoPayload =
        params.action === 'video'
          ? {
              generatedAt: toIsoString(params.generatedAt),
              videoUrl: params.videoUrl ?? null,
              model: selectedModel?.trim() ? selectedModel.trim() : null,
              generationParams: generationParams ?? null,
            }
          : undefined;

      if (hasEditsSinceLastVersion) {
        const newVersion = createVersionEntry({
          signature,
          prompt: promptText,
          highlights: latestHighlightRef.current ?? null,
          preview: previewPayload ?? null,
          video: videoPayload ?? null,
        });
        persistVersions([...currentVersions, newVersion]);
        resetVersionEdits();
        return;
      }

      if (!lastVersion) return;
      const updatedLast: PromptVersionEntry = {
        ...lastVersion,
        ...(previewPayload ? { preview: previewPayload } : {}),
        ...(videoPayload ? { video: videoPayload } : {}),
      };
      const updatedVersions = [...currentVersions.slice(0, -1), updatedLast];
      persistVersions(updatedVersions);
    },
    [
      currentPromptUuid,
      currentPromptEntry,
      currentVersions,
      createVersionEntry,
      effectiveAspectRatio,
      generationParams,
      latestHighlightRef,
      persistVersions,
      resetVersionEdits,
      selectedModel,
    ]
  );

  const syncVersionHighlights = useCallback(
    (snapshot: HighlightSnapshot, promptText: string): void => {
      if (!currentPromptUuid) return;
      if (!currentPromptEntry) return;
      if (!snapshot?.signature) return;

      const versions = currentVersions;
      if (versions.length === 0) {
        const fallbackPrompt = promptText.trim();
        if (!fallbackPrompt) return;
        const initialVersion = createVersionEntry({
          signature: snapshot.signature,
          prompt: fallbackPrompt,
          highlights: snapshot,
        });
        persistVersions([initialVersion]);
        resetVersionEdits();
        return;
      }

      const lastVersion = versions[versions.length - 1];
      if (lastVersion.signature !== snapshot.signature) {
        return;
      }

      const updatedLast: PromptVersionEntry = {
        ...lastVersion,
        highlights: snapshot,
      };
      persistVersions([...versions.slice(0, -1), updatedLast]);
    },
    [
      createVersionEntry,
      currentPromptEntry,
      currentPromptUuid,
      currentVersions,
      persistVersions,
      resetVersionEdits,
    ]
  );

  return { upsertVersionOutput, syncVersionHighlights };
}
