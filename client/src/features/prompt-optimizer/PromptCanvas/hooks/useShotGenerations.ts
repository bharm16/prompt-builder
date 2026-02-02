import { useCallback, useMemo } from 'react';
import type { ContinuityShot, UpdateShotInput } from '@/features/continuity/types';
import { createHighlightSignature } from '@/features/span-highlighting';
import type { PromptHistoryEntry, PromptVersionEntry } from '@hooks/types';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import {
  mapShotStatusToGenerationStatus,
  resolveVersionTimestamp,
} from '../utils/versioning';

interface UseShotGenerationsOptions {
  currentShot: ContinuityShot | null;
  updateShot: (shotId: string, updates: UpdateShotInput) => Promise<ContinuityShot>;
}

interface UseShotGenerationsResult {
  shotId: string | null;
  sequenceGenerations: Generation[];
  sequenceVersions: PromptVersionEntry[];
  shotPromptEntry: PromptHistoryEntry | null;
  updateShotVersions: (versions: PromptVersionEntry[]) => void;
}

export function useShotGenerations({
  currentShot,
  updateShot,
}: UseShotGenerationsOptions): UseShotGenerationsResult {
  const shotId = currentShot?.id ?? null;

  const sequenceGenerationVersionId = useMemo(() => {
    if (!currentShot) return null;
    const versions = (currentShot.versions as PromptVersionEntry[] | undefined) ?? [];
    const existing = versions.length ? versions[versions.length - 1]?.versionId : undefined;
    return existing ?? `shot-${currentShot.id}`;
  }, [currentShot]);

  const sequenceVideoUrl = useMemo(() => {
    if (!currentShot?.videoAssetId) return null;
    return `/api/preview/video/content/${currentShot.videoAssetId}`;
  }, [currentShot?.videoAssetId]);

  const sequenceGenerations = useMemo<Generation[]>(() => {
    if (!currentShot || !sequenceGenerationVersionId) return [];
    const status = mapShotStatusToGenerationStatus(currentShot.status);
    const hasOutput = Boolean(currentShot.videoAssetId || currentShot.generatedKeyframeUrl);
    const shouldRender = hasOutput || status !== 'pending';
    if (!shouldRender) return [];
    const createdAtMs = resolveVersionTimestamp(currentShot.createdAt) ?? Date.now();
    const completedAtMs =
      resolveVersionTimestamp(currentShot.generatedAt) ??
      (status === 'completed' ? createdAtMs : null);
    return [
      {
        id: currentShot.id,
        tier: 'render',
        status,
        model: currentShot.modelId,
        prompt: currentShot.userPrompt ?? '',
        promptVersionId: sequenceGenerationVersionId,
        createdAt: createdAtMs,
        completedAt: completedAtMs,
        mediaType: 'video',
        mediaUrls: sequenceVideoUrl ? [sequenceVideoUrl] : [],
        ...(currentShot.videoAssetId ? { mediaAssetIds: [currentShot.videoAssetId] } : {}),
        thumbnailUrl: currentShot.generatedKeyframeUrl ?? null,
      },
    ];
  }, [currentShot, sequenceGenerationVersionId, sequenceVideoUrl]);

  const sequenceVersions = useMemo<PromptVersionEntry[]>(() => {
    if (!currentShot) return [];
    const existing = (currentShot.versions ?? []) as PromptVersionEntry[];
    if (existing.length > 0) {
      if (
        sequenceGenerations.length > 0 &&
        !existing.some((version) =>
          Array.isArray(version.generations) && version.generations.length > 0
        )
      ) {
        const patched = [...existing];
        const targetIndex = patched.length - 1;
        const target = patched[targetIndex];
        if (target) {
          patched[targetIndex] = { ...target, generations: sequenceGenerations };
          return patched;
        }
      }
      return existing;
    }
    if (!sequenceGenerations.length || !sequenceGenerationVersionId) return [];
    const promptText = currentShot.userPrompt ?? '';
    const signature = createHighlightSignature(promptText);
    const rawTimestamp = currentShot.generatedAt ?? currentShot.createdAt ?? new Date().toISOString();
    const timestamp = typeof rawTimestamp === 'string' && rawTimestamp.trim()
      ? rawTimestamp
      : new Date().toISOString();
    return [
      {
        versionId: sequenceGenerationVersionId,
        label: 'v1',
        signature,
        prompt: promptText,
        timestamp,
        ...(currentShot.generatedKeyframeUrl
          ? {
              preview: {
                generatedAt: timestamp,
                imageUrl: currentShot.generatedKeyframeUrl,
                aspectRatio: null,
              },
            }
          : {}),
        ...(sequenceVideoUrl
          ? {
              video: {
                generatedAt: timestamp,
                videoUrl: sequenceVideoUrl,
                model: currentShot.modelId ?? null,
                generationParams: null,
              },
            }
          : {}),
        generations: sequenceGenerations,
      },
    ];
  }, [currentShot, sequenceGenerationVersionId, sequenceGenerations, sequenceVideoUrl]);

  const shotPromptEntry = useMemo<PromptHistoryEntry | null>(() => {
    if (!currentShot) return null;
    return {
      uuid: currentShot.id,
      input: currentShot.userPrompt ?? '',
      output: '',
      versions: sequenceVersions,
    };
  }, [currentShot, sequenceVersions]);

  const updateShotVersions = useCallback(
    (versions: PromptVersionEntry[]) => {
      if (!shotId) return;
      void updateShot(shotId, { versions });
    },
    [shotId, updateShot]
  );

  return {
    shotId,
    sequenceGenerations,
    sequenceVersions,
    shotPromptEntry,
    updateShotVersions,
  };
}
