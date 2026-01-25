import { useCallback, useMemo, useRef, type MutableRefObject } from 'react';
import { createHighlightSignature } from '@/features/span-highlighting';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptVersionEdit, PromptVersionEntry } from '@hooks/types';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import type { HighlightSnapshot } from '../types';
import type { PromptHistory } from '../../context/types';

interface UsePromptVersioningOptions {
  promptHistory: PromptHistory;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  activeVersionId?: string | null;
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
  syncVersionGenerations: (generations: Generation[]) => void;
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

const serializeGeneration = (gen: Generation): string =>
  JSON.stringify({
    id: gen.id,
    tier: gen.tier,
    status: gen.status,
    model: gen.model,
    mediaType: gen.mediaType,
    promptVersionId: gen.promptVersionId ?? null,
    createdAt: gen.createdAt,
    completedAt: gen.completedAt ?? null,
    estimatedCost: gen.estimatedCost ?? null,
    actualCost: gen.actualCost ?? null,
    aspectRatio: gen.aspectRatio ?? null,
    duration: gen.duration ?? null,
    fps: gen.fps ?? null,
    thumbnailUrl: gen.thumbnailUrl ?? null,
    error: gen.error ?? null,
    mediaUrls: gen.mediaUrls ?? [],
  });

const areGenerationsEqual = (
  left?: Generation[] | null,
  right?: Generation[] | null
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (serializeGeneration(left[i]) !== serializeGeneration(right[i])) {
      return false;
    }
  }
  return true;
};

/**
 * Extract the best thumbnail URL from a list of generations.
 * Prioritizes: explicit thumbnailUrl > image mediaUrls > first media URL
 */
const extractThumbnailFromGenerations = (generations: Generation[]): string | null => {
  const completed = generations.filter((g) => g.status === 'completed');
  if (!completed.length) return null;

  // First, look for an explicit thumbnailUrl (set by flux-kontext storyboard)
  for (const gen of completed) {
    if (gen.thumbnailUrl && typeof gen.thumbnailUrl === 'string' && gen.thumbnailUrl.trim()) {
      return gen.thumbnailUrl.trim();
    }
  }

  // Next, prefer image or image-sequence media types
  for (const gen of completed) {
    if ((gen.mediaType === 'image' || gen.mediaType === 'image-sequence') && gen.mediaUrls.length) {
      const url = gen.mediaUrls[0];
      if (url && typeof url === 'string' && url.trim()) {
        return url.trim();
      }
    }
  }

  // Finally, fall back to any first media URL (e.g., video poster frame if available)
  for (const gen of completed) {
    if (gen.mediaUrls.length) {
      const url = gen.mediaUrls[0];
      if (url && typeof url === 'string' && url.trim()) {
        return url.trim();
      }
    }
  }

  return null;
};

export function usePromptVersioning({
  promptHistory,
  currentPromptUuid,
  currentPromptDocId,
  activeVersionId,
  latestHighlightRef,
  versionEditCountRef,
  versionEditsRef,
  resetVersionEdits,
  effectiveAspectRatio,
  generationParams,
  selectedModel,
}: UsePromptVersioningOptions): UsePromptVersioningReturn {
  // Track last persisted thumbnail to prevent infinite update loops
  const lastPersistedThumbnailRef = useRef<string | null>(null);

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

  // Bug 12/13 fix: refs for fresh values in callbacks to avoid stale closures
  const currentVersionsRef = useRef(currentVersions);
  currentVersionsRef.current = currentVersions;
  const currentPromptEntryRef = useRef(currentPromptEntry);
  currentPromptEntryRef.current = currentPromptEntry;

  const persistVersions = useCallback(
    (versions: PromptVersionEntry[]): void => {
      if (!currentPromptUuid) return;
      // Bug 13 fix: read entry from ref to avoid stale docId after draft promotion
      const entry = currentPromptEntryRef.current;
      const resolvedDocId = entry?.id ?? currentPromptDocId;
      promptHistory.updateEntryVersions(currentPromptUuid, resolvedDocId ?? null, versions);
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
      if (!currentPromptEntryRef.current) return;
      const promptText = params.prompt.trim();
      if (!promptText) return;

      const versions = currentVersionsRef.current;
      const signature = createHighlightSignature(promptText);
      const lastVersion = versions[versions.length - 1] ?? null;
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
        persistVersions([...versions, newVersion]);
        resetVersionEdits();
        return;
      }

      if (!lastVersion) return;
      const updatedLast: PromptVersionEntry = {
        ...lastVersion,
        ...(previewPayload ? { preview: previewPayload } : {}),
        ...(videoPayload ? { video: videoPayload } : {}),
      };
      const updatedVersions = [...versions.slice(0, -1), updatedLast];
      persistVersions(updatedVersions);
    },
    [
      currentPromptUuid,
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
      if (!currentPromptEntryRef.current) return;
      if (!snapshot?.signature) return;

      const versions = currentVersionsRef.current;
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
      if (!lastVersion) {
        return;
      }
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
      currentPromptUuid,
      persistVersions,
      resetVersionEdits,
    ]
  );

  // Bug 12 fix: read currentVersions/currentPromptEntry from refs to avoid stale closures
  const syncVersionGenerations = useCallback(
    (generations: Generation[]): void => {
      if (!currentPromptUuid) return;
      if (!currentPromptEntryRef.current) return;

      const versions = currentVersionsRef.current;
      if (!versions.length) return;

      const index = activeVersionId
        ? versions.findIndex((version) => version.versionId === activeVersionId)
        : versions.length - 1;
      if (index < 0) return;

      const target = versions[index];
      if (!target) return;

      // Extract thumbnail from completed generations for the preview field
      const thumbnailUrl = extractThumbnailFromGenerations(generations);
      const existingPreviewUrl = target.preview?.imageUrl;

      // Use ref to prevent infinite loops - only update if thumbnail actually changed
      // and we haven't just persisted this same thumbnail
      const alreadyPersisted = thumbnailUrl === lastPersistedThumbnailRef.current;
      const shouldUpdatePreview = Boolean(
        thumbnailUrl &&
          thumbnailUrl !== existingPreviewUrl &&
          !alreadyPersisted
      );

      // Check if generations changed or if we have a new thumbnail to persist
      const generationsChanged = !areGenerationsEqual(target.generations, generations);
      if (!generationsChanged && !shouldUpdatePreview) {
        return;
      }

      const updated: PromptVersionEntry = {
        ...target,
        generations: generations.length ? generations : [],
      };

      // Update preview with thumbnail from generations if available
      if (shouldUpdatePreview && thumbnailUrl) {
        updated.preview = {
          generatedAt: new Date().toISOString(),
          imageUrl: thumbnailUrl,
          aspectRatio: target.preview?.aspectRatio ?? null,
        };
        // Track that we've persisted this thumbnail to prevent re-triggering
        lastPersistedThumbnailRef.current = thumbnailUrl;
      }

      const updatedVersions = [...versions];
      updatedVersions[index] = updated;
      persistVersions(updatedVersions);
    },
    [activeVersionId, currentPromptUuid, persistVersions]
  );

  return { upsertVersionOutput, syncVersionHighlights, syncVersionGenerations };
}
