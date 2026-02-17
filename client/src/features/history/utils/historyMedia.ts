import type { PromptHistoryEntry } from '@features/prompt-optimizer/types/domain/prompt-session';

export interface HistoryThumbnailRef {
  url: string | null;
  storagePath?: string | null;
  assetId?: string | null;
}

export function resolveHistoryThumbnail(entry: PromptHistoryEntry): HistoryThumbnailRef {
  const versions = Array.isArray(entry.versions) ? entry.versions : [];
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const preview = versions[i]?.preview;
    const candidate = preview?.imageUrl;
    const storagePath = preview?.storagePath ?? null;
    const assetId = preview?.assetId ?? null;
    if (typeof candidate === 'string' && candidate.trim()) {
      return { url: candidate, storagePath, assetId };
    }
    if (storagePath || assetId) {
      return { url: null, storagePath, assetId };
    }
  }
  return { url: null };
}

export function hasVideoArtifact(entry: PromptHistoryEntry): boolean {
  const versions = Array.isArray(entry.versions) ? entry.versions : [];
  return versions.some((version) => {
    const url = version?.video?.videoUrl;
    return typeof url === 'string' && url.trim().length > 0;
  });
}

export function isRecentEntry(entry: PromptHistoryEntry, days: number = 7): boolean {
  if (!entry.timestamp) return false;
  const ms = Date.parse(entry.timestamp);
  if (Number.isNaN(ms)) return false;
  const diffMs = Date.now() - ms;
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}
