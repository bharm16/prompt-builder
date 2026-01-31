import { useCallback, useMemo, useRef, type MutableRefObject } from 'react';
import { createHighlightSignature } from '@/features/span-highlighting';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptVersionEdit, PromptVersionEntry } from '@hooks/types';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { areGenerationsEqual } from '@/features/prompt-optimizer/GenerationsPanel/utils/generationComparison';
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

/**
 * Determine which of two Generation records is "more complete".
 * A generation is considered more complete when it has a terminal status
 * (completed/failed) and/or has populated media data.  This prevents a
 * concurrent persist triggered by a newly-added (still "generating")
 * generation from erasing an already-completed sibling generation's data.
 */
const generationCompleteness = (gen: Generation): number => {
  let score = 0;
  if (gen.status === 'completed') score += 10;
  if (gen.status === 'failed') score += 5;
  if (gen.mediaUrls.length > 0) score += 3;
  if (gen.thumbnailUrl) score += 1;
  if (gen.completedAt) score += 1;
  return score;
};

/**
 * Merge an incoming generations array with the already-persisted generations
 * on the version entry.  For each generation ID that appears in both arrays,
 * the more complete record wins (see `generationCompleteness`).  Generations
 * that only exist in the persisted set are preserved; generations that only
 * exist in the incoming set are appended.  The order follows the incoming
 * array, with any persisted-only entries appended at the end.
 *
 * This avoids the race where a persist for gen2 (status: "generating")
 * overwrites gen1 (status: "completed") because the callback read a stale
 * snapshot that didn't include gen1's completed data.
 */
const mergeGenerationsById = (
  persisted: Generation[] | null | undefined,
  incoming: Generation[]
): Generation[] => {
  if (!persisted?.length) return incoming;
  // Bug 18 safeguard: if incoming is empty, preserve persisted data rather than wiping it.
  // This prevents a stale callback with an empty array from erasing completed generations.
  if (!incoming.length) return persisted;

  const persistedMap = new Map<string, Generation>();
  for (const gen of persisted) {
    persistedMap.set(gen.id, gen);
  }

  const incomingIds = new Set<string>();
  const merged: Generation[] = incoming.map((incomingGen) => {
    incomingIds.add(incomingGen.id);
    const persistedGen = persistedMap.get(incomingGen.id);
    if (!persistedGen) return incomingGen;

    // Pick the more complete record
    const incomingScore = generationCompleteness(incomingGen);
    const persistedScore = generationCompleteness(persistedGen);
    return incomingScore >= persistedScore ? incomingGen : persistedGen;
  });

  // Append any persisted generations not present in the incoming array.
  // These are generations that the current local state doesn't know about
  // (e.g., completed gen1 that was persisted but lost from local state).
  for (const gen of persisted) {
    if (!incomingIds.has(gen.id)) {
      merged.push(gen);
    }
  }

  return merged;
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
      // Eagerly update ref so concurrent callbacks in the same render cycle
      // read fresh data instead of overwriting each other's changes
      currentVersionsRef.current = versions;
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
        ...(typeof highlights !== 'undefined' ? { highlights } : {}),
        ...(editCount > 0 ? { editCount } : {}),
        ...(edits.length ? { edits } : {}),
        ...(typeof preview !== 'undefined' ? { preview } : {}),
        ...(typeof video !== 'undefined' ? { video } : {}),
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
          highlights: latestHighlightRef.current ?? undefined,
          preview: previewPayload,
          video: videoPayload,
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

      // Merge incoming generations with already-persisted ones by ID,
      // preferring the more complete record for each generation.
      const mergedGenerations = mergeGenerationsById(target.generations, generations);

      // Extract thumbnail from the merged set (includes all completed generations)
      const thumbnailUrl = extractThumbnailFromGenerations(mergedGenerations);
      const existingPreviewUrl = target.preview?.imageUrl;

      const alreadyPersisted = thumbnailUrl === lastPersistedThumbnailRef.current;
      const shouldUpdatePreview = Boolean(
        thumbnailUrl &&
          thumbnailUrl !== existingPreviewUrl &&
          !alreadyPersisted
      );

      // Check if generations changed or if we have a new thumbnail to persist
      const generationsChanged = !areGenerationsEqual(target.generations, mergedGenerations);

      if (!generationsChanged && !shouldUpdatePreview) return;

      const updated: PromptVersionEntry = {
        ...target,
        generations: mergedGenerations.length ? mergedGenerations : [],
      };

      // Update preview with thumbnail from generations if available
      if (shouldUpdatePreview && thumbnailUrl) {
        updated.preview = {
          generatedAt: new Date().toISOString(),
          imageUrl: thumbnailUrl,
          aspectRatio: target.preview?.aspectRatio ?? null,
        };
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
