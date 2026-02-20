import type { PromptVersionEntry } from '@features/prompt-optimizer/types/domain/prompt-session';
import { getModelConfig } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import type {
  GalleryGeneration,
  GalleryPromptSpan,
  GalleryTier,
} from '@/features/prompt-optimizer/components/GalleryPanel';

interface GalleryGenerationEntry {
  gallery: GalleryGeneration;
  generation: Generation;
}

interface BuildGalleryGenerationEntriesOptions {
  versions: PromptVersionEntry[];
  runtimeGenerations: Generation[];
}

type VersionGenerationSource = {
  generation: Generation;
  promptSpans: GalleryPromptSpan[];
  versionTimestamp: number | null;
  versionPreviewImageUrl: string | null;
};

const resolveTimestamp = (generation: Generation, versionTimestamp: number | null): number =>
  generation.completedAt ?? generation.createdAt ?? versionTimestamp ?? Date.now();

const mapTier = (generation: Generation): GalleryTier => {
  if (generation.mediaType === 'image-sequence') return 'preview';
  if (generation.tier === 'draft') return 'draft';
  return 'final';
};

const isLikelyVideoUrl = (url: string): boolean => {
  const value = url.toLowerCase();
  if (value.includes('/api/preview/video/content/')) {
    return true;
  }
  return /\.(mp4|webm|mov|m3u8)(\?|#|$)/.test(value);
};

const normalizeNonEmpty = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const resolveThumbnailUrl = (
  generation: Generation,
  versionPreviewImageUrl: string | null
): string | null => {
  const isCompletedGeneration = generation.status === 'completed';
  const normalizedThumbnail = normalizeNonEmpty(generation.thumbnailUrl);
  const normalizedVersionPreview = normalizeNonEmpty(versionPreviewImageUrl);

  if (generation.mediaType === 'video') {
    if (normalizedThumbnail && !isLikelyVideoUrl(normalizedThumbnail)) {
      return normalizedThumbnail;
    }
    if (
      isCompletedGeneration &&
      normalizedVersionPreview &&
      !isLikelyVideoUrl(normalizedVersionPreview)
    ) {
      return normalizedVersionPreview;
    }
    return null;
  }

  if (normalizedThumbnail) {
    return normalizedThumbnail;
  }

  const firstMediaUrl = normalizeNonEmpty(generation.mediaUrls[0]);
  if (firstMediaUrl) {
    return firstMediaUrl;
  }

  if (isCompletedGeneration && normalizedVersionPreview) {
    return normalizedVersionPreview;
  }

  return null;
};

const parsePromptSpans = (highlights: PromptVersionEntry['highlights']): GalleryPromptSpan[] => {
  if (!highlights || typeof highlights !== 'object') return [];
  if (!Array.isArray((highlights as { spans?: unknown }).spans)) return [];

  const spans = (highlights as { spans: unknown[] }).spans;
  return spans
    .map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      const maybe = candidate as {
        start?: unknown;
        end?: unknown;
        category?: unknown;
      };
      if (
        typeof maybe.start !== 'number' ||
        typeof maybe.end !== 'number' ||
        typeof maybe.category !== 'string'
      ) {
        return null;
      }
      if (maybe.start < 0 || maybe.end <= maybe.start) return null;
      return {
        start: maybe.start,
        end: maybe.end,
        category: maybe.category,
      };
    })
    .filter((span): span is GalleryPromptSpan => Boolean(span));
};

const generationCompleteness = (generation: Generation): number => {
  let score = 0;
  if (generation.status === 'completed') score += 10;
  if (generation.status === 'failed') score += 5;
  if (generation.mediaUrls.length > 0) score += 3;
  if (generation.thumbnailUrl) score += 1;
  if (generation.completedAt) score += 1;
  return score;
};

const mergeGeneration = (incoming: Generation, existing: Generation): Generation => ({
  ...(generationCompleteness(incoming) >= generationCompleteness(existing)
    ? incoming
    : existing),
  isFavorite:
    typeof incoming.isFavorite === 'boolean'
      ? incoming.isFavorite
      : typeof existing.isFavorite === 'boolean'
        ? existing.isFavorite
        : false,
  generationSettings:
    incoming.generationSettings ?? existing.generationSettings ?? null,
});

const formatDuration = (duration: number | null | undefined): string | undefined =>
  typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? `${duration}s`
    : undefined;

const mapGalleryGeneration = (
  generation: Generation,
  promptSpans: GalleryPromptSpan[],
  versionTimestamp: number | null,
  versionPreviewImageUrl: string | null
): GalleryGeneration => ({
  id: generation.id,
  tier: mapTier(generation),
  thumbnailUrl: resolveThumbnailUrl(generation, versionPreviewImageUrl),
  mediaUrl: generation.mediaUrls[0] ?? null,
  mediaType: generation.mediaType,
  prompt: generation.prompt ?? '',
  model: getModelConfig(generation.model)?.label ?? generation.model,
  duration: formatDuration(generation.duration),
  aspectRatio: generation.aspectRatio ?? undefined,
  createdAt: resolveTimestamp(generation, versionTimestamp),
  isFavorite: Boolean(generation.isFavorite),
  generationSettings: generation.generationSettings ?? null,
  promptSpans,
});

export function buildGalleryGenerationEntries({
  versions,
  runtimeGenerations,
}: BuildGalleryGenerationEntriesOptions): GalleryGenerationEntry[] {
  const versionGenerations: VersionGenerationSource[] = [];
  for (const version of versions) {
    if (!Array.isArray(version.generations) || version.generations.length === 0) continue;
    const timestamp = Date.parse(version.timestamp);
    const versionTimestamp = Number.isFinite(timestamp) ? timestamp : null;
    const promptSpans = parsePromptSpans(version.highlights);
    const versionPreviewImageUrl = normalizeNonEmpty(version.preview?.imageUrl ?? null);
    for (const generation of version.generations) {
      versionGenerations.push({
        generation,
        promptSpans,
        versionTimestamp,
        versionPreviewImageUrl,
      });
    }
  }

  const mergedById = new Map<string, VersionGenerationSource>();
  for (const source of versionGenerations) {
    mergedById.set(source.generation.id, source);
  }

  for (const generation of runtimeGenerations) {
    const existing = mergedById.get(generation.id);
    if (!existing) {
      mergedById.set(generation.id, {
        generation,
        promptSpans: [],
        versionTimestamp: null,
        versionPreviewImageUrl: null,
      });
      continue;
    }

    mergedById.set(generation.id, {
      ...existing,
      generation: mergeGeneration(generation, existing.generation),
    });
  }

  return Array.from(mergedById.values())
    .map((source) => ({
      gallery: mapGalleryGeneration(
        source.generation,
        source.promptSpans,
        source.versionTimestamp,
        source.versionPreviewImageUrl
      ),
      generation: source.generation,
    }))
    .sort((left, right) => right.gallery.createdAt - left.gallery.createdAt);
}
